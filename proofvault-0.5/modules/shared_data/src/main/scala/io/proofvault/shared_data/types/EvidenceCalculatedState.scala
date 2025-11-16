package io.proofvault.shared_data.types

import org.tessellation.currency.dataApplication.DataCalculatedState
import derevo.circe.magnolia.{decoder, encoder}
import derevo.derive

@derive(decoder, encoder)
final case class EvidenceCalculatedState(
  totalEvidence: Long,
  verifiedEvidence: Map[String, EvidenceRecord],
  lastSnapshotOrdinal: Long
) extends DataCalculatedState

object EvidenceCalculatedState {
  val genesis: EvidenceCalculatedState = EvidenceCalculatedState(
    totalEvidence = 0L,
    verifiedEvidence = Map.empty,
    lastSnapshotOrdinal = 0L
  )
}
