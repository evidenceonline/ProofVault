package io.proofvault.shared_data.model

import derevo.circe.magnolia.{decoder, encoder}
import derevo.derive
import org.tessellation.currency.dataApplication.DataUpdate

/** TextUpdate using derevo annotations like NFT example */
@derive(decoder, encoder)
final case class TextUpdate(id: String, hash: String) extends DataUpdate