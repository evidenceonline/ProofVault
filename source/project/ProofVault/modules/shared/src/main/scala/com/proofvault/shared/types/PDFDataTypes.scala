package com.proofvault.shared.types

import cats.implicits._
import cats.effect.Sync
import derevo.cats.{eqv, show}
import derevo.circe.magnolia.{decoder, encoder}
import derevo.derive
import eu.timepit.refined.auto._
import io.circe.refined._
import com.proofvault.shared.compatibility.DataApplicationCompat._
import org.http4s.HttpRoutes
import org.tessellation.schema.SnapshotOrdinal
import org.tessellation.schema.address.Address
import org.tessellation.security.hash.Hash
import org.tessellation.security.signature.Signed

import java.util.UUID

// PDF Evidence Update - represents a state change in the PDF registry
@derive(encoder, decoder, eqv, show)
sealed trait PDFUpdate extends DataUpdate

@derive(encoder, decoder, eqv, show)
case class RegisterPDF(
  hash: String,              // SHA-256 hash of PDF content
  url: String,               // Storage URL or IPFS hash
  title: String,             // Document title
  captureTimestamp: Long,    // When the PDF was captured
  submitterAddress: Address, // Who submitted the PDF
  registrationId: String = UUID.randomUUID().toString
) extends PDFUpdate

object RegisterPDF {
  def isValidHash(hash: String): Boolean = 
    hash.matches("^[a-fA-F0-9]{64}$")
}

// PDF State - represents the current state of all registered PDFs
@derive(encoder, decoder, eqv, show)
case class PDFState(
  registeredPDFs: Map[String, PDFInfo]
) extends DataState[PDFState, PDFUpdate] {
  
  def combine(other: PDFState): PDFState = 
    PDFState(registeredPDFs ++ other.registeredPDFs)
  
  def applyUpdate(update: PDFUpdate): PDFState = update match {
    case RegisterPDF(hash, url, title, timestamp, submitter, id) =>
      val info = PDFInfo(hash, url, title, timestamp, submitter, id)
      PDFState(registeredPDFs + (hash -> info))
  }
}

@derive(encoder, decoder, eqv, show)
case class PDFInfo(
  hash: String,
  url: String,
  title: String,
  captureTimestamp: Long,
  submitterAddress: Address,
  registrationId: String
)

// Calculated state includes derived information
@derive(encoder, decoder, eqv, show)
case class PDFCalculatedState(
  registeredPDFs: Map[String, PDFInfo],
  totalRegistrations: Long,
  registrationsByAddress: Map[Address, List[String]] // Address -> List of PDF hashes
) extends DataCalculatedState

object PDFCalculatedState {
  def from(
    state: PDFState,
    ordinal: SnapshotOrdinal
  ): PDFCalculatedState = {
    val registrationsByAddress = state.registeredPDFs.values
      .groupBy(_.submitterAddress)
      .view
      .mapValues(_.map(_.hash).toList)
      .toMap
      
    PDFCalculatedState(
      registeredPDFs = state.registeredPDFs,
      totalRegistrations = state.registeredPDFs.size.toLong,
      registrationsByAddress = registrationsByAddress
    )
  }
}

// On-chain state for lightweight consensus
@derive(encoder, decoder, eqv, show)
case class PDFOnChainState(
  lastHash: Option[String],
  totalCount: Long
) extends OnChainState

// Data application definition
object PDFDataApplication extends DataApplication[
  PDFUpdate,
  PDFState,
  PDFCalculatedState,
  PDFOnChainState
] {
  
  override def name: String = "PDFEvidence"
  
  override def validateUpdate(
    state: DataState[PDFState, PDFUpdate],
    update: PDFUpdate
  )(implicit context: L1NodeContext[_]): IO[DataApplicationValidationError, Unit] = 
    update match {
      case RegisterPDF(hash, url, title, timestamp, _, _) =>
        for {
          _ <- validateHashFormat(hash)
          _ <- validateDuplicate(state.asInstanceOf[PDFState], hash)
          _ <- validateTimestamp(timestamp)
          _ <- validateMetadata(url, title)
        } yield ()
    }
    
  override def validateData(
    state: DataState[PDFState, PDFUpdate],
    updates: NonEmptyList[Signed[PDFUpdate]]
  )(implicit context: L1NodeContext[_]): IO[DataApplicationValidationError, Unit] = 
    updates.traverse_ { signedUpdate =>
      validateUpdate(state, signedUpdate.value)
    }
    
  override def combine(
    state: DataState[PDFState, PDFUpdate],
    updates: List[Signed[PDFUpdate]]
  )(implicit context: L1NodeContext[_]): IO[DataApplicationValidationError, PDFState] = 
    IO.pure {
      updates.foldLeft(state.asInstanceOf[PDFState]) { (acc, signedUpdate) =>
        acc.applyUpdate(signedUpdate.value)
      }
    }
    
  override def getCalculatedState(
    state: DataState[PDFState, PDFUpdate]
  )(implicit context: L1NodeContext[_]): IO[DataApplicationValidationError, PDFCalculatedState] = 
    IO.pure(PDFCalculatedState.from(state.asInstanceOf[PDFState], context.getLastSnapshot.ordinal))
    
  override def hashCalculatedState(
    state: DataCalculatedState
  )(implicit context: L1NodeContext[_]): IO[DataApplicationValidationError, Hash] = 
    IO.pure(Hash.empty) // Implement proper hashing
    
  override def serializeState(
    state: DataState[PDFState, PDFUpdate]
  ): IO[DataApplicationValidationError, Array[Byte]] = 
    IO.pure(Array.empty) // Implement serialization
    
  override def deserializeState(
    bytes: Array[Byte]
  ): IO[DataApplicationValidationError, DataState[PDFState, PDFUpdate]] = 
    IO.pure(PDFState(Map.empty)) // Implement deserialization
    
  override def serializeUpdate(
    update: PDFUpdate
  ): IO[DataApplicationValidationError, Array[Byte]] = 
    IO.pure(Array.empty) // Implement serialization
    
  override def deserializeUpdate(
    bytes: Array[Byte]
  ): IO[DataApplicationValidationError, PDFUpdate] = 
    IO.pure(RegisterPDF("", "", "", 0L, Address("DAG0" + "0" * 36), "")) // Implement deserialization
    
  override def getOnChainState(
    state: DataState[PDFState, PDFUpdate]
  )(implicit context: L1NodeContext[_]): IO[DataApplicationValidationError, PDFOnChainState] = {
    val pdfState = state.asInstanceOf[PDFState]
    val lastHash = pdfState.registeredPDFs.values.toList
      .sortBy(_.captureTimestamp)
      .lastOption
      .map(_.hash)
      
    IO.pure(PDFOnChainState(lastHash, pdfState.registeredPDFs.size.toLong))
  }
  
  override def serializeCalculatedState(
    state: DataCalculatedState
  ): IO[DataApplicationValidationError, Array[Byte]] = 
    IO.pure(Array.empty) // Implement serialization
    
  override def deserializeCalculatedState(
    bytes: Array[Byte]
  ): IO[DataApplicationValidationError, DataCalculatedState] = 
    IO.pure(PDFCalculatedState(Map.empty, 0L, Map.empty)) // Implement deserialization
    
  override def serializeOnChainState(
    state: OnChainState
  ): IO[DataApplicationValidationError, Array[Byte]] = 
    IO.pure(Array.empty) // Implement serialization
    
  override def deserializeOnChainState(
    bytes: Array[Byte]
  ): IO[DataApplicationValidationError, OnChainState] = 
    IO.pure(PDFOnChainState(None, 0L)) // Implement deserialization
    
  override def genesis: DataState[PDFState, PDFUpdate] = 
    PDFState(Map.empty)
    
  override def routes[F[_]](implicit context: L1NodeContext[F]): HttpRoutes[F] = 
    new HttpRoutes[F] {
      def run(req: org.http4s.Request[F]): cats.data.OptionT[F, org.http4s.Response[F]] = 
        cats.data.OptionT.none
    }
    
  // Validation helpers
  private def validateHashFormat(hash: String): IO[DataApplicationValidationError, Unit] = 
    if (RegisterPDF.isValidHash(hash)) 
      IO.unit
    else 
      IO.raiseError(DataApplicationValidationError(s"Invalid SHA-256 hash format: $hash"))
      
  private def validateDuplicate(state: PDFState, hash: String): IO[DataApplicationValidationError, Unit] = 
    if (state.registeredPDFs.contains(hash))
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