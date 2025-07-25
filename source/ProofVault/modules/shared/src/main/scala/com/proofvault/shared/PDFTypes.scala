package com.proofvault.shared

import org.tessellation.schema.address.Address
import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}
import java.util.UUID

// PDF Metadata containing information about the captured document
case class PDFMetadata(
  originalUrl: String,
  captureTimestamp: Long,
  title: String,
  submitterAddress: Address,
  contentType: String = "application/pdf"
)

object PDFMetadata {
  implicit val encoder: Encoder[PDFMetadata] = deriveEncoder
  implicit val decoder: Decoder[PDFMetadata] = deriveDecoder
}

// PDF Record representing a registered PDF document
case class PDFRecord(
  hash: String,              // SHA-256 hash of PDF content
  url: String,               // Storage URL or IPFS hash
  title: String,             // Document title
  captureTimestamp: Long,    // When the PDF was captured
  submitterAddress: Address, // Who submitted the PDF
  metadata: PDFMetadata,     // Additional metadata
  registrationId: String = UUID.randomUUID().toString // Unique identifier
)

object PDFRecord {
  implicit val encoder: Encoder[PDFRecord] = deriveEncoder
  implicit val decoder: Decoder[PDFRecord] = deriveDecoder
  
  // Validate SHA-256 hash format (64 character hex string)
  def isValidHash(hash: String): Boolean = 
    hash.matches("^[a-fA-F0-9]{64}$")
}

// PDF Registration Data - embedded in transaction metadata
case class PDFRegistrationData(
  pdfRecord: PDFRecord,
  signature: String, // Digital signature of the PDF hash
  version: String = "1.0"
)

object PDFRegistrationData {
  implicit val encoder: Encoder[PDFRegistrationData] = deriveEncoder
  implicit val decoder: Decoder[PDFRegistrationData] = deriveDecoder
}

// State representation for PDF registry
case class PDFRegistryState(
  registeredPDFs: Map[String, PDFRecord] = Map.empty,
  totalRegistrations: Long = 0,
  lastUpdated: Long = System.currentTimeMillis()
) {
  
  // Check if a PDF hash is already registered
  def isHashRegistered(hash: String): Boolean = 
    registeredPDFs.contains(hash)
  
  // Get a PDF record by hash
  def getPDFByHash(hash: String): Option[PDFRecord] = 
    registeredPDFs.get(hash)
  
  // Get all PDFs submitted by a specific address
  def getPDFsBySubmitter(address: Address): List[PDFRecord] = 
    registeredPDFs.values.filter(_.submitterAddress == address).toList
  
  // Register a new PDF
  def registerPDF(record: PDFRecord): PDFRegistryState = 
    if (isHashRegistered(record.hash)) this
    else copy(
      registeredPDFs = registeredPDFs + (record.hash -> record),
      totalRegistrations = totalRegistrations + 1,
      lastUpdated = System.currentTimeMillis()
    )
}

object PDFRegistryState {
  implicit val encoder: Encoder[PDFRegistryState] = deriveEncoder
  implicit val decoder: Decoder[PDFRegistryState] = deriveDecoder
  
  val empty: PDFRegistryState = PDFRegistryState()
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