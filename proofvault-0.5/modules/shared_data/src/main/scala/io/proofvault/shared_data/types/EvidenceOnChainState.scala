package io.proofvault.shared_data.types

import org.tessellation.currency.dataApplication.DataOnChainState
import derevo.circe.magnolia.{decoder, encoder}
import derevo.derive

@derive(decoder, encoder)
final case class EvidenceOnChainState(
  pendingEvidence: Map[String, EvidenceRecord]
) extends DataOnChainState

object EvidenceOnChainState {
  val genesis: EvidenceOnChainState = EvidenceOnChainState(Map.empty)
}
