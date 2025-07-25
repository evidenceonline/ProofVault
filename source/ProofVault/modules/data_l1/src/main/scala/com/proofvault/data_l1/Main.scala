package com.proofvault.data_l1

import java.util.UUID
import cats.effect.{IO, Resource}
import cats.implicits._
import org.tessellation.BuildInfo
import org.tessellation.currency.dataApplication._
import org.tessellation.currency.l1.CurrencyL1App
import org.tessellation.dag.l1.config.types.AppConfig
import org.tessellation.schema.cluster.ClusterId
import org.tessellation.schema.semver.{MetagraphVersion, TessellationVersion}
import org.tessellation.security.signature.Signed
import com.proofvault.shared.PDFRegistrationData
import com.proofvault.shared.types._
import eu.timepit.refined.auto._
import org.http4s._
import org.http4s.dsl.io._
import org.http4s.circe.CirceEntityCodec._
import scala.collection.concurrent.TrieMap

object Main extends CurrencyL1App(
  "proofvault-data-l1",
  "ProofVault PDF Evidence Data L1 node",
  ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
  tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version),
  metagraphVersion = MetagraphVersion.unsafeFrom(BuildInfo.version)
) {
  
  // Create a data application instance
  override def dataApplication: Option[Resource[IO, BaseDataApplicationL1Service[IO]]] = 
    Some(makeDataApplicationL1Service)
    
  private def makeDataApplicationL1Service: Resource[IO, BaseDataApplicationL1Service[IO]] = {
    Resource.pure(new PDFEvidenceDataApplicationL1Service())
  }
}

class PDFEvidenceDataApplicationL1Service extends BaseDataApplicationL1Service[IO] {
  
  // Thread-safe storage for PDF registry
  private val pdfRegistry = TrieMap.empty[String, PDFInfo]
  
  override def validateUpdate(
    update: DataUpdate,
    state: DataOnChainState
  ): IO[DataApplicationValidationError, Unit] = update match {
    case RegisterPDF(hash, url, title, timestamp, submitter, id) =>
      for {
        _ <- validateHashFormat(hash)
        _ <- validateNotDuplicate(hash)
        _ <- validateTimestamp(timestamp)
        _ <- validateMetadata(url, title)
      } yield ()
    case _ => 
      IO.raiseError(DataApplicationValidationError("Unknown update type"))
  }
  
  override def validateData(
    updates: NonEmptyList[Signed[DataUpdate]]
  ): IO[DataApplicationValidationError, Unit] = 
    updates.traverse_ { signedUpdate =>
      validateUpdate(signedUpdate.value, DataOnChainState.empty)
    }
  
  override def combine(
    state: DataOnChainState,
    updates: List[Signed[DataUpdate]]
  ): IO[DataApplicationValidationError, DataOnChainState] = {
    
    // Process each update
    updates.foreach { signedUpdate =>
      signedUpdate.value match {
        case RegisterPDF(hash, url, title, timestamp, submitter, id) =>
          val info = PDFInfo(hash, url, title, timestamp, submitter, id)
          pdfRegistry.put(hash, info)
        case _ => // Ignore unknown updates
      }
    }
    
    // Return updated on-chain state
    val lastHash = pdfRegistry.values.toList
      .sortBy(_.captureTimestamp)
      .lastOption
      .map(_.hash)
      
    IO.pure(PDFOnChainState(lastHash, pdfRegistry.size.toLong))
  }
  
  override def routes: HttpRoutes[IO] = HttpRoutes.of[IO] {
    // Query PDF by hash
    case GET -> Root / "pdf" / hash =>
      pdfRegistry.get(hash) match {
        case Some(pdf) => Ok(pdf)
        case None => NotFound(s"PDF with hash $hash not found")
      }
      
    // List all PDFs
    case GET -> Root / "pdfs" =>
      Ok(pdfRegistry.values.toList)
      
    // Get PDFs by submitter
    case GET -> Root / "pdfs" / "by-submitter" / address =>
      val pdfs = pdfRegistry.values
        .filter(_.submitterAddress.value == address)
        .toList
      Ok(pdfs)
      
    // Get registry stats
    case GET -> Root / "stats" =>
      Ok(Map(
        "totalRegistrations" -> pdfRegistry.size,
        "uniqueSubmitters" -> pdfRegistry.values.map(_.submitterAddress).toSet.size
      ))
  }
  
  // Validation helpers
  private def validateHashFormat(hash: String): IO[DataApplicationValidationError, Unit] = 
    if (hash.matches("^[a-fA-F0-9]{64}$")) 
      IO.unit
    else 
      IO.raiseError(DataApplicationValidationError(s"Invalid SHA-256 hash format: $hash"))
      
  private def validateNotDuplicate(hash: String): IO[DataApplicationValidationError, Unit] = 
    if (pdfRegistry.contains(hash))
      IO.raiseError(DataApplicationValidationError(s"PDF with hash $hash already registered"))
    else
      IO.unit
      
  private def validateTimestamp(timestamp: Long): IO[DataApplicationValidationError, Unit] = 
    if (timestamp > 0 && timestamp <= System.currentTimeMillis())
      IO.unit
    else
      IO.raiseError(DataApplicationValidationError(s"Invalid timestamp: $timestamp"))
      
  private def validateMetadata(url: String, title: String): IO[DataApplicationValidationError, Unit] = 
    if (url.nonEmpty && title.nonEmpty && title.length <= 500)
      IO.unit
    else
      IO.raiseError(DataApplicationValidationError("Invalid metadata"))
}

// Empty on-chain state for compatibility
case class DataOnChainState() {
  def empty: DataOnChainState = DataOnChainState()
}

object DataOnChainState {
  val empty: DataOnChainState = DataOnChainState()
}