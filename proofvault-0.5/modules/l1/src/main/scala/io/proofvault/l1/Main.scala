package io.proofvault.l1

import org.tessellation.BuildInfo
import org.tessellation.currency.l1.CurrencyL1App
import org.tessellation.schema.cluster.ClusterId
import org.tessellation.schema.semver.{MetagraphVersion, TessellationVersion}

import java.util.UUID

/** Nodo Currency-L1 “vacío” – sólo arranca el stack Tessellation y
  * expone los endpoints estándar (`/node/info`, `/node/peers`, …).
  *  No requiere lógica adicional mientras no implementes smart-contracts
  *  o data-apps en la capa L1.
  */
object Main
  extends CurrencyL1App(
    "currency-l1",
    "currency L1 node",
    ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
    metagraphVersion   = MetagraphVersion.unsafeFrom(BuildInfo.version),
    tessellationVersion = TessellationVersion.unsafeFrom(BuildInfo.version)
  )
