package com.proofvault.l1

import org.scalatest.wordspec.AnyWordSpec
import org.scalatest.matchers.should.Matchers
import org.tessellation.schema.address.Address
import org.tessellation.schema.transaction.{Transaction, TransactionReference}
import org.tessellation.security.Hashed
import org.tessellation.security.signature.Signed
import org.tessellation.dag.l1.domain.transaction.TransactionValidatorContext
import eu.timepit.refined.auto._
import eu.timepit.refined.types.numeric.NonNegLong

class PDFValidationSpec extends AnyWordSpec with Matchers {
  
  "PDF Transaction Validator" should {
    
    "validate correct SHA-256 hash format" in {
      val validHash = "a" * 64 // 64 character hex string
      Main.isValidSHA256Hash(validHash) shouldBe true
      
      val invalidHash1 = "z" * 64 // invalid characters
      Main.isValidSHA256Hash(invalidHash1) shouldBe false
      
      val invalidHash2 = "a" * 63 // too short
      Main.isValidSHA256Hash(invalidHash2) shouldBe false
      
      val invalidHash3 = "a" * 65 // too long
      Main.isValidSHA256Hash(invalidHash3) shouldBe false
    }
    
    "identify PDF registration transactions" in {
      val sourceAddr = Address("DAG1" + "0" * 36)
      val pdfRegistryAddr = Address("DAG8" + "0" * 36)
      val normalAddr = Address("DAG2" + "0" * 36)
      
      // PDF registration transaction (0 amount to DAG8* address)
      val pdfTx = createTransaction(
        source = sourceAddr,
        destination = pdfRegistryAddr,
        amount = 0L
      )
      
      // Normal transaction (non-zero amount)
      val normalTx1 = createTransaction(
        source = sourceAddr,
        destination = pdfRegistryAddr,
        amount = 100L
      )
      
      // Normal transaction (wrong destination prefix)
      val normalTx2 = createTransaction(
        source = sourceAddr,
        destination = normalAddr,
        amount = 0L
      )
      
      isPDFRegistration(pdfTx) shouldBe true
      isPDFRegistration(normalTx1) shouldBe false
      isPDFRegistration(normalTx2) shouldBe false
    }
    
    "extract PDF hash from transaction salt" in {
      val expectedHash = "1234567890abcdef" + "0" * 48 // 64 chars total
      val salt = BigInt("1234567890abcdef", 16).toLong
      
      val tx = createTransaction(
        source = Address("DAG1" + "0" * 36),
        destination = Address("DAG8" + "0" * 36),
        amount = 0L,
        salt = salt
      )
      
      val extractedHash = Main.extractPDFHash(tx)
      extractedHash shouldBe defined
      extractedHash.get should startWith("1234567890abcdef")
      extractedHash.get.length shouldBe 64
    }
    
    "prevent duplicate PDF registrations" in {
      // This would test the actual validator with state
      // In a real test, we'd need to mock the TransactionValidatorContext
      // and test the full validation flow
      
      val hash = "a" * 64
      val tx1 = createPDFRegistrationTx(hash)
      val tx2 = createPDFRegistrationTx(hash)
      
      // First registration should succeed
      // Second registration with same hash should fail
      // This requires integration testing with the actual validator
    }
  }
  
  // Helper methods
  
  private def createTransaction(
    source: Address,
    destination: Address,
    amount: Long,
    salt: Long = 0L
  ): Transaction = {
    Transaction(
      source = source,
      destination = destination,
      amount = NonNegLong(amount),
      fee = NonNegLong(0L),
      parent = TransactionReference.empty,
      salt = salt
    )
  }
  
  private def isPDFRegistration(tx: Transaction): Boolean = {
    tx.amount.value == 0L && tx.destination.value.startsWith("DAG8")
  }
  
  private def createPDFRegistrationTx(hash: String): Transaction = {
    // Simplified - in reality would use proper encoding
    val salt = BigInt(hash.take(16), 16).toLong
    createTransaction(
      source = Address("DAG1" + "0" * 36),
      destination = Address("DAG8" + hash.take(36)),
      amount = 0L,
      salt = salt
    )
  }
}

/**
 * Example of how to test the full validation flow
 */
class PDFValidationIntegrationSpec extends AnyWordSpec with Matchers {
  
  "PDF Registration Integration" should {
    
    "successfully register a valid PDF" in {
      // Create test data
      val pdfHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      val sourceAddress = Address("DAG1" + "0" * 36)
      val registryAddress = Address("DAG8" + pdfHash.take(36))
      
      // Create registration transaction
      val tx = Transaction(
        source = sourceAddress,
        destination = registryAddress,
        amount = NonNegLong(0L),
        fee = NonNegLong(0L),
        parent = TransactionReference.empty,
        salt = 12345L
      )
      
      // In a real test, would validate through the actual system
      tx.amount.value shouldBe 0L
      tx.destination.value should startWith("DAG8")
    }
    
    "reject invalid PDF hash formats" in {
      val invalidHash = "not-a-valid-hash"
      val sourceAddress = Address("DAG1" + "0" * 36)
      
      // Would test actual validation rejection
      Main.isValidSHA256Hash(invalidHash) shouldBe false
    }
    
    "handle concurrent registration attempts" in {
      // Test thread safety of the TrieMap implementation
      // Would spawn multiple threads trying to register same hash
      // Only one should succeed
    }
  }
}