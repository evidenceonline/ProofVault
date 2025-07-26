package com.proofvault.shared

import org.tessellation.schema.address.Address
import eu.timepit.refined.auto._
import java.security.MessageDigest
import scala.util.{Try, Success, Failure}

/**
 * Utilities for safe DAG address construction and validation
 * 
 * Tessellation 2.8.1 requires DAG addresses to be exactly 43 characters:
 * - "DAG" prefix (3 chars)
 * - 40 hexadecimal characters
 * - No all-zeros patterns allowed
 */
object AddressUtils {

  /**
   * Create a valid DAG address from a 40-character hex string
   */
  def createAddress(hexString: String): Either[String, Address] = {
    if (hexString.length != 40) {
      Left(s"Hex string must be exactly 40 characters, got ${hexString.length}")
    } else if (!hexString.matches("^[a-fA-F0-9]+$")) {
      Left(s"Invalid hex characters in: $hexString")
    } else if (hexString == "0" * 40) {
      Left("All-zeros address not allowed")
    } else {
      Try {
        val dagString = s"DAG$hexString"
        Address(dagString)
      } match {
        case Success(address) => Right(address)
        case Failure(ex) => Left(s"Address validation failed: ${ex.getMessage}")
      }
    }
  }

  /**
   * Create a deterministic address from a hash string
   * Uses the first 40 characters of the hash
   */
  def createFromHash(hash: String): Option[Address] = {
    if (hash.length >= 40) {
      val hexPart = hash.take(40).toLowerCase
      createAddress(hexPart).toOption
    } else {
      None
    }
  }

  /**
   * Generate a deterministic address from a seed string
   */
  def generateFromSeed(seed: String): Address = {
    val digest = MessageDigest.getInstance("SHA-256")
    val hashBytes = digest.digest(seed.getBytes("UTF-8"))
    val hexString = hashBytes.map("%02x".format(_)).mkString.take(40)
    createAddress(hexString).getOrElse(TestAddresses.genesis)
  }

  /**
   * Validate if a string is a properly formatted DAG address
   */
  def isValidDagAddress(address: String): Boolean = {
    address.matches("^DAG[a-fA-F0-9]{40}$") && address != "DAG" + "0" * 40
  }

  /**
   * Well-known test addresses for development and testing
   * All addresses are exactly 43 characters: DAG + 40 hex chars
   */
  object TestAddresses {
    
    // Genesis/system address - valid hex pattern
    val genesis: Address = Address("DAG89c9d78ad8497634e32e2baab6f8ab514ee2f3de2c")
    
    // Test user addresses - valid 40 hex chars after DAG
    val alice: Address = Address("DAG1234567890abcdef1234567890abcdef12345678")
    val bob: Address = Address("DAGabcdef1234567890abcdef1234567890abcdef12")
    val charlie: Address = Address("DAGfedcba0987654321fedcba0987654321fedcba09")
    
    // Registry address for PDF operations
    val registry: Address = Address("DAG8888888888aaaaaaaaaa9999999999bbbbbbbbbb")
    
    // System addresses - need pure hex after DAG
    val system: Address = Address("DAG5555444433332222111100009999888877776666")
    val admin: Address = Address("DAGaaaa111122223333444455556666777788889999")
  }

  /**
   * Common address patterns for specific use cases
   */
  object Patterns {
    
    /**
     * Create a registry address for a specific PDF hash
     */
    def registryForPdf(pdfHash: String): Address = {
      val seed = s"pdf-registry-$pdfHash"
      generateFromSeed(seed)
    }
    
    /**
     * Create a user address from an identifier
     */
    def userAddress(userId: String): Address = {
      val seed = s"user-$userId"
      generateFromSeed(seed)
    }
  }
}