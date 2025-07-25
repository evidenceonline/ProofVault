package com.proofvault.l0

import java.util.UUID
import org.tessellation.BuildInfo
import org.tessellation.currency.l0.CurrencyL0App
import org.tessellation.schema.cluster.ClusterId
import org.tessellation.schema.semver.{MetagraphVersion, TessellationVersion}

object Main extends CurrencyL0App(
  "proofvault-l0",
  "ProofVault PDF Evidence L0 node",
  ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
  tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version),
  metagraphVersion = MetagraphVersion.unsafeFrom(BuildInfo.version)
) {
  // The L0 layer will handle consensus and state management
  // Custom logic will be implemented through the shared data types
  // and validated in the L1 layer
}