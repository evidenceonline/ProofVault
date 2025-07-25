package com.proofvault.l1

import java.util.UUID
import org.tessellation.BuildInfo
import org.tessellation.currency.l1.CurrencyL1App
import org.tessellation.schema.cluster.ClusterId
import org.tessellation.schema.transaction.Transaction
import org.tessellation.schema.semver.{MetagraphVersion, TessellationVersion}
import org.tessellation.security.Hashed
import org.tessellation.dag.l1.domain.transaction.{CustomContextualTransactionValidator, TransactionValidatorContext}
import org.tessellation.dag.l1.domain.transaction.ContextualTransactionValidator.CustomValidationError
import eu.timepit.refined.auto._
import scala.collection.concurrent.TrieMap
import org.slf4j.LoggerFactory

object Main extends CurrencyL1App(
  "proofvault-l1",
  "ProofVault PDF Evidence L1 node",
  ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
  tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version),
  metagraphVersion = MetagraphVersion.unsafeFrom(BuildInfo.version)
) {
  
  private val logger = LoggerFactory.getLogger(getClass)
  
  // Thread-safe storage for registered PDF hashes
  // In production, this would be persisted and synchronized
  private val registeredHashes = TrieMap.empty[String, Long]
  
  override def transactionValidator: Option[CustomContextualTransactionValidator] = Some {
    (hashedTransaction: Hashed[Transaction], context: TransactionValidatorContext) =>
      
      val tx = hashedTransaction.signed.value
      
      // Custom validation for PDF registration transactions
      // We identify PDF registrations by specific patterns in the transaction
      
      // Check if this is a PDF registration (0 amount transfers to a specific address pattern)
      val isPDFRegistration = tx.amount.value == 0L && 
                             tx.destination.value.startsWith("DAG8") // PDF registry address prefix
      
      if (isPDFRegistration) {
        // Extract PDF hash from transaction data
        // In a real implementation, this would parse custom data fields
        val pdfHashOpt = extractPDFHash(tx)
        
        pdfHashOpt match {
          case Some(pdfHash) =>
            // Validate hash format
            if (!isValidSHA256Hash(pdfHash)) {
              Left(CustomValidationError(s"Invalid PDF hash format: $pdfHash"))
            } 
            // Check for duplicates
            else if (registeredHashes.contains(pdfHash)) {
              Left(CustomValidationError(s"PDF with hash $pdfHash already registered"))
            } 
            // Validation passed
            else {
              // Register the hash
              registeredHashes.put(pdfHash, System.currentTimeMillis())
              logger.info(s"Registered PDF with hash: $pdfHash")
              Right(hashedTransaction)
            }
            
          case None =>
            Left(CustomValidationError("PDF registration transaction missing hash data"))
        }
      } else {
        // Not a PDF transaction, pass through standard validation
        Right(hashedTransaction)
      }
  }
  
  // Helper to extract PDF hash from transaction
  // In production, this would parse actual transaction data fields
  private def extractPDFHash(tx: Transaction): Option[String] = {
    // Mock implementation - extracts hash from salt field for testing
    // Real implementation would use proper data encoding
    if (tx.salt > 0) {
      Some(f"${tx.salt}%064x") // Convert to 64-char hex string
    } else {
      None
    }
  }
  
  // Validate SHA-256 hash format
  private def isValidSHA256Hash(hash: String): Boolean = {
    hash.matches("^[a-fA-F0-9]{64}$")
  }
}