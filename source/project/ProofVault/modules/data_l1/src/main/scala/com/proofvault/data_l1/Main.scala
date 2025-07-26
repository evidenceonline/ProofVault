package com.proofvault.data_l1

import java.util.UUID
import cats.effect.{IO, Resource}
import cats.implicits._
import cats.data.NonEmptyList
import org.tessellation.BuildInfo
import org.tessellation.currency.l1.CurrencyL1App
import org.tessellation.schema.cluster.ClusterId
import org.tessellation.schema.semver.{MetagraphVersion, TessellationVersion}
import org.tessellation.security.signature.Signed
import eu.timepit.refined.auto._

object Main extends CurrencyL1App(
  "proofvault-data-l1",
  "ProofVault PDF Evidence Data L1 node",
  ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
  tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version),
  metagraphVersion = MetagraphVersion.unsafeFrom(BuildInfo.version)
) {
  
  // Data application not implemented in this simplified version
  // Would require proper Tessellation data application API integration
}

// PDF Evidence Data Application L1 Service
// This would be implemented when proper Tessellation data application API is integrated
// For now, the data_l1 module only provides basic L1 currency functionality