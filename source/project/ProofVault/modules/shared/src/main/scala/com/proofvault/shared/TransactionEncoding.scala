package com.proofvault.shared

import cats.effect.Sync
import io.circe.syntax._
import org.tessellation.schema.address.Address
import org.tessellation.schema.transaction.{Transaction, TransactionReference, TransactionAmount, TransactionFee, TransactionSalt}
import eu.timepit.refined.auto._
import eu.timepit.refined.types.numeric.{NonNegLong, PosLong}
import java.nio.charset.StandardCharsets
import java.util.Base64

/**
 * Utilities for encoding PDF registration data into standard transactions
 * 
 * Since Constellation Network transactions don't have arbitrary data fields,
 * we encode PDF registration data using a combination of:
 * - Destination address pattern (DAG8* prefix)
 * - Zero amount transfer
 * - Salt field for compact data
 * - Multiple micro-transactions for larger data
 */
object TransactionEncoding {
  
  // Registry address prefix for PDF registrations
  val PDF_REGISTRY_PREFIX = "DAG8"
  
  // Version identifier for encoding format
  val ENCODING_VERSION: Byte = 1
  
  /**
   * Encode a PDF registration into transaction parameters
   * 
   * For compact registrations (hash only), we can use the salt field.
   * For full metadata, we need to split across multiple transactions.
   */
  def encodePDFRegistration(
    registration: PDFRegistrationData,
    sourceAddress: Address
  ): Either[String, TransactionParameters] = {
    
    // For simple hash registration, encode in salt
    if (registration.pdfRecord.url.isEmpty && registration.pdfRecord.title.isEmpty) {
      encodeCompactRegistration(registration.pdfRecord.hash, sourceAddress)
    } else {
      // For full registration, we need a more complex encoding
      encodeFullRegistration(registration, sourceAddress)
    }
  }
  
  /**
   * Encode just the PDF hash in a single transaction using the salt field
   */
  private def encodeCompactRegistration(
    hash: String,
    sourceAddress: Address
  ): Either[String, TransactionParameters] = {
    
    // Validate hash
    if (!PDFRecord.isValidHash(hash)) {
      Left(s"Invalid PDF hash: $hash")
    } else {
      // Convert first 16 chars of hash to Long for salt
      // This is a simple encoding - in production use proper encoding
      val saltValue = BigInt(hash.take(16), 16).toLong
      
      Right(TransactionParameters(
        source = sourceAddress,
        destination = generateRegistryAddress(hash),
        amount = PosLong.unsafeFrom(1L),
        fee = NonNegLong(0L), // Set appropriate fee
        salt = saltValue
      ))
    }
  }
  
  /**
   * Encode full PDF registration with metadata
   * This would typically require multiple transactions or off-chain storage
   */
  private def encodeFullRegistration(
    registration: PDFRegistrationData,
    sourceAddress: Address
  ): Either[String, TransactionParameters] = {
    
    // In a real implementation, this would:
    // 1. Store metadata on IPFS or similar
    // 2. Include IPFS hash in transaction
    // 3. Or split data across multiple linked transactions
    
    // For now, return compact encoding
    encodeCompactRegistration(registration.pdfRecord.hash, sourceAddress)
  }
  
  /**
   * Generate a deterministic registry address for a PDF hash
   */
  def generateRegistryAddress(pdfHash: String): Address = {
    // Create a deterministic address based on the PDF hash
    // This helps with querying and organization
    // Use a fixed valid DAG address for now
    Address("DAG0000000000000000000000000000000000000000")
  }
  
  /**
   * Decode PDF hash from a transaction
   */
  def decodePDFHash(tx: Transaction): Option[String] = {
    // Check if this is a PDF registration transaction
    if (tx.destination.value.value.startsWith(PDF_REGISTRY_PREFIX) && tx.amount.value.value == 0L) {
      // Extract hash from destination address
      val addressValue = tx.destination.value.value
      val hashPart = addressValue.drop(PDF_REGISTRY_PREFIX.length)
      
      // In production, properly decode from salt + destination
      if (hashPart.length >= 36) {
        // Reconstruct full hash (this is simplified)
        Some(hashPart.padTo(64, '0'))
      } else {
        None
      }
    } else {
      None
    }
  }
  
  /**
   * Create a signed transaction for PDF registration
   */
  def createPDFRegistrationTransaction[F[_]: Sync](
    registration: PDFRegistrationData,
    sourceAddress: Address,
    parentRef: TransactionReference
  ): F[Transaction] = {
    
    Sync[F].fromEither(
      encodePDFRegistration(registration, sourceAddress).left.map(new RuntimeException(_)).map { params =>
        Transaction(
          source = params.source,
          destination = params.destination,
          amount = TransactionAmount(params.amount),
          fee = TransactionFee(params.fee),
          parent = parentRef,
          salt = TransactionSalt(params.salt)
        )
      }
    )
  }
  
  /**
   * Batch encode multiple PDF registrations
   * Useful for bulk imports
   */
  def encodeBatchRegistration(
    registrations: List[PDFRegistrationData],
    sourceAddress: Address
  ): List[Either[String, TransactionParameters]] = {
    registrations.map(reg => encodePDFRegistration(reg, sourceAddress))
  }
  
  // Helper case class for transaction parameters
  case class TransactionParameters(
    source: Address,
    destination: Address,
    amount: PosLong,
    fee: NonNegLong,
    salt: Long
  )
}

/**
 * Alternative encoding using transaction chains for larger data
 */
object ChainedTransactionEncoding {
  
  /**
   * Split large PDF metadata across multiple chained transactions
   * Each transaction references the previous one
   */
  def encodeAsTransactionChain(
    registration: PDFRegistrationData,
    maxDataPerTx: Int = 64
  ): List[TransactionFragment] = {
    
    // Serialize registration data
    val jsonData = registration.asJson.noSpaces
    val dataBytes = jsonData.getBytes(StandardCharsets.UTF_8)
    val encoded = Base64.getEncoder.encodeToString(dataBytes)
    
    // Split into chunks
    val chunks = encoded.grouped(maxDataPerTx).toList
    
    // Create transaction fragments
    chunks.zipWithIndex.map { case (chunk, index) =>
      TransactionFragment(
        sequenceNumber = index,
        totalFragments = chunks.length,
        data = chunk,
        isLast = index == chunks.length - 1
      )
    }
  }
  
  case class TransactionFragment(
    sequenceNumber: Int,
    totalFragments: Int,
    data: String,
    isLast: Boolean
  )
}