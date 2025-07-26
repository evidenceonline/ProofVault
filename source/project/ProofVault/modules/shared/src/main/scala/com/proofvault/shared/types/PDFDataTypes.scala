package com.proofvault.shared.types

import derevo.cats.{eqv, show}
import derevo.circe.magnolia.{decoder, encoder}
import derevo.derive
import org.tessellation.schema.address.Address

import java.util.UUID

// PDF Evidence Update - represents a state change in the PDF registry
@derive(encoder, decoder, eqv, show)
sealed trait PDFUpdate

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
) {
  
  def combine(other: PDFState): PDFState = 
    PDFState(registeredPDFs ++ other.registeredPDFs)
  
  def applyUpdate(update: PDFUpdate): PDFState = update match {
    case RegisterPDF(hash, url, title, timestamp, submitter, id) =>
      val info = PDFInfo(hash, url, title, timestamp, submitter, id)
      PDFState(registeredPDFs + (hash -> info))
  }
  
  def isHashRegistered(hash: String): Boolean = 
    registeredPDFs.contains(hash)
  
  def getPDFByHash(hash: String): Option[PDFInfo] = 
    registeredPDFs.get(hash)
  
  def getPDFsBySubmitter(address: Address): List[PDFInfo] = 
    registeredPDFs.values.filter(_.submitterAddress == address).toList
}

object PDFState {
  val empty: PDFState = PDFState(Map.empty)
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
)

object PDFCalculatedState {
  def from(state: PDFState): PDFCalculatedState = {
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
)

object PDFOnChainState {
  def from(state: PDFState): PDFOnChainState = {
    val lastHash = state.registeredPDFs.values.toList
      .sortBy(_.captureTimestamp)
      .lastOption
      .map(_.hash)
      
    PDFOnChainState(lastHash, state.registeredPDFs.size.toLong)
  }
}

// Validation errors specific to PDF operations
sealed trait PDFValidationError {
  def message: String
}

object PDFValidationError {
  case class InvalidHashFormat(hash: String) extends PDFValidationError {
    val message = s"Invalid SHA-256 hash format: $hash. Must be 64 character hex string."
  }
  
  case class DuplicateHash(hash: String) extends PDFValidationError {
    val message = s"PDF with hash $hash is already registered."
  }
  
  case class InvalidMetadata(field: String, value: String) extends PDFValidationError {
    val message = s"Invalid metadata field $field: $value"
  }
  
  case class InvalidTimestamp(timestamp: Long) extends PDFValidationError {
    val message = s"Invalid timestamp: $timestamp. Must be a valid Unix timestamp."
  }
}