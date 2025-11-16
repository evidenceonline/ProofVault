package io.proofvault.shared_data.types

import derevo.circe.magnolia.{decoder, encoder}
import derevo.derive

@derive(decoder, encoder)
final case class EvidenceRecord(
  id: String,
  hash: String,
  timestamp: Long,
  status: String
)

object EvidenceRecord {
  def fromTextUpdate(textUpdate: io.proofvault.shared_data.model.TextUpdate): EvidenceRecord = {
    EvidenceRecord(
      id = textUpdate.id,
      hash = textUpdate.hash,
      timestamp = System.currentTimeMillis(),
      status = "pending"
    )
  }
}
