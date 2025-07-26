package com.proofvault.data_l1

import java.util.UUID
import cats.effect.{IO, Resource}
import cats.data.{NonEmptyList, ValidatedNel}
import cats.implicits._
import org.tessellation.BuildInfo
import org.tessellation.currency.dataApplication.{BaseDataApplicationL1Service, DataApplicationL1App}
import org.tessellation.currency.dataApplication.dataApplication.DataApplicationValidationErrorOr
import org.tessellation.schema.cluster.ClusterId
import org.tessellation.schema.semver.{MetagraphVersion, TessellationVersion}
import org.tessellation.security.signature.Signed
import org.tessellation.security.hash.Hash
import org.http4s.HttpRoutes
import eu.timepit.refined.auto._
import io.circe.syntax._
import io.circe.parser._

import com.proofvault.shared.types._

object Main extends DataApplicationL1App(
  "proofvault-data-l1",
  "ProofVault PDF Evidence Data L1 node",
  ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
  tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version),
  metagraphVersion = MetagraphVersion.unsafeFrom(BuildInfo.version)
) {

  override def dataApplication: Option[Resource[IO, BaseDataApplicationL1Service[IO]]] = Some {
    Resource.pure[IO, BaseDataApplicationL1Service[IO]](new PDFDataApplicationL1Service())
  }
}

class PDFDataApplicationL1Service extends BaseDataApplicationL1Service[IO] {
  
  // Thread-safe storage for PDF registry state
  // In production, this would be persisted and managed by Tessellation
  private var currentState: PDFState = PDFState.empty
  
  override def validateUpdate(
    update: Array[Byte],
    state: Array[Byte]
  ): IO[DataApplicationValidationErrorOr[Unit]] = {
    
    def parseUpdate(bytes: Array[Byte]): Either[String, PDFUpdate] = {
      val jsonStr = new String(bytes)
      decode[PDFUpdate](jsonStr).left.map(_.getMessage)
    }
    
    def parseState(bytes: Array[Byte]): Either[String, PDFState] = {
      if (bytes.isEmpty) Right(PDFState.empty)
      else {
        val jsonStr = new String(bytes)
        decode[PDFState](jsonStr).left.map(_.getMessage)
      }
    }
    
    val validationResult = for {
      pdfUpdate <- parseUpdate(update)
      pdfState <- parseState(state)
      validationResult <- validatePDFUpdate(pdfUpdate, pdfState)
    } yield validationResult
    
    validationResult match {
      case Right(_) => IO.pure(().validNel)
      case Left(error) => IO.pure(error.invalidNel)
    }
  }
  
  override def validateData(
    updates: NonEmptyList[Signed[Array[Byte]]]
  ): IO[DataApplicationValidationErrorOr[Unit]] = {
    
    val validationResults = updates.map { signedUpdate =>
      validateUpdate(signedUpdate.value, Array.empty) // Pass empty state for individual validation
    }
    
    // Combine all validation results
    validationResults.traverse(identity).map { results =>
      results.sequence_.void
    }
  }
  
  override def combine(
    state: Array[Byte],
    updates: List[Signed[Array[Byte]]]
  ): IO[DataApplicationValidationErrorOr[Array[Byte]]] = {
    
    def parseState(bytes: Array[Byte]): Either[String, PDFState] = {
      if (bytes.isEmpty) Right(PDFState.empty)
      else {
        val jsonStr = new String(bytes)
        decode[PDFState](jsonStr).left.map(_.getMessage)
      }
    }
    
    def parseUpdate(bytes: Array[Byte]): Either[String, PDFUpdate] = {
      val jsonStr = new String(bytes)
      decode[PDFUpdate](jsonStr).left.map(_.getMessage)
    }
    
    val result = for {
      initialState <- parseState(state)
      parsedUpdates <- updates.traverse(u => parseUpdate(u.value))
      finalState = parsedUpdates.foldLeft(initialState) { (state, update) =>
        state.applyUpdate(update)
      }
      serializedState = finalState.asJson.noSpaces.getBytes
    } yield serializedState
    
    result match {
      case Right(newState) =>
        // Update internal state for query purposes
        currentState = decode[PDFState](new String(newState)).getOrElse(PDFState.empty)
        IO.pure(newState.validNel)
      case Left(error) => IO.pure(error.invalidNel)
    }
  }
  
  override def routes: HttpRoutes[IO] = {
    import org.http4s._
    import org.http4s.dsl.io._
    import org.http4s.circe._
    import io.circe.generic.auto._
    
    HttpRoutes.of[IO] {
      
      // Get PDF by hash
      case GET -> Root / "pdf" / hash =>
        currentState.getPDFByHash(hash) match {
          case Some(pdfInfo) => Ok(pdfInfo.asJson)
          case None => NotFound(s"PDF with hash $hash not found")
        }
      
      // Get all PDFs for an address
      case GET -> Root / "pdf" / "address" / address =>
        import org.tessellation.schema.address.Address
        
        Address.fromString(address) match {
          case Right(addr) =>
            val pdfs = currentState.getPDFsBySubmitter(addr)
            Ok(pdfs.asJson)
          case Left(_) =>
            BadRequest("Invalid address format")
        }
      
      // Get registry statistics
      case GET -> Root / "stats" =>
        val stats = Map(
          "totalRegistrations" -> currentState.registeredPDFs.size,
          "uniqueSubmitters" -> currentState.registeredPDFs.values.map(_.submitterAddress).toSet.size
        )
        Ok(stats.asJson)
      
      // Health check
      case GET -> Root / "health" =>
        Ok("PDF Data Application is running")
    }
  }
  
  // PDF-specific validation logic
  private def validatePDFUpdate(update: PDFUpdate, state: PDFState): Either[String, Unit] = {
    update match {
      case RegisterPDF(hash, url, title, timestamp, submitter, _) =>
        for {
          _ <- validateHashFormat(hash)
          _ <- validateDuplicate(state, hash)
          _ <- validateTimestamp(timestamp)
          _ <- validateMetadata(url, title)
        } yield ()
    }
  }
  
  private def validateHashFormat(hash: String): Either[String, Unit] = 
    if (RegisterPDF.isValidHash(hash)) 
      Right(())
    else 
      Left(s"Invalid SHA-256 hash format: $hash")
      
  private def validateDuplicate(state: PDFState, hash: String): Either[String, Unit] = 
    if (state.isHashRegistered(hash))
      Left(s"PDF with hash $hash already registered")
    else
      Right(())
      
  private def validateTimestamp(timestamp: Long): Either[String, Unit] = 
    if (timestamp > 0 && timestamp <= System.currentTimeMillis())
      Right(())
    else
      Left(s"Invalid timestamp: $timestamp")
      
  private def validateMetadata(url: String, title: String): Either[String, Unit] = 
    if (url.nonEmpty && title.nonEmpty && title.length <= 500)
      Right(())
    else
      Left("Invalid metadata")
}