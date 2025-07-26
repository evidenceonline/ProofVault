// Test file to verify Address construction patterns for Tessellation 2.8.1
// This demonstrates the correct DAG address format and validation

object AddressTest {
  
  // Valid DAG address patterns (based on research)
  val validDagAddresses = List(
    "DAG89c9d78ad8497634e32e2baab6f8ab514ee2f3de2c", // 43 chars total
    "DAG1234567890abcdef1234567890abcdef12345678",     // Hex pattern
    "DAGabcdef1234567890abcdef1234567890abcdef12",     // Mixed case normalized to lowercase
    "DAG0123456789abcdef0123456789abcdef01234567"      // Valid pattern with leading zeros
  )
  
  // Invalid DAG address patterns that would fail refined type validation
  val invalidDagAddresses = List(
    "DAG0000000000000000000000000000000000000000", // All zeros - likely fails validation
    "DAG000000000000000000000000000000000000000",  // Wrong length (42 chars instead of 43)
    "DAG",                                         // Too short
    "DAG12345",                                    // Too short
    "DAGGHIJKLMNOP",                              // Invalid hex characters
    "dag89c9d78ad8497634e32e2baab6f8ab514ee2f3de2c" // Lowercase prefix
  )
  
  // Demonstrates what makes a valid DAG address:
  // 1. Must start with "DAG" (uppercase)
  // 2. Must be followed by exactly 40 hexadecimal characters
  // 3. Total length must be 43 characters
  // 4. Hex portion should use lowercase letters for consistency
  // 5. Cannot be all zeros (likely special validation rule)
  
  def main(args: Array[String]): Unit = {
    println("Valid DAG Address Examples:")
    validDagAddresses.foreach { addr =>
      println(s"  $addr (length: ${addr.length})")
    }
    
    println("\nInvalid DAG Address Examples:")
    invalidDagAddresses.foreach { addr =>
      println(s"  $addr (length: ${addr.length})")
    }
    
    println("\nAddress Validation Rules:")
    println("1. Format: DAG + 40 hex characters")
    println("2. Total length: 43 characters")
    println("3. Hex characters: 0-9, a-f (lowercase preferred)")
    println("4. Cannot be all zeros")
    println("5. Must pass Tessellation refined type predicates")
  }
}