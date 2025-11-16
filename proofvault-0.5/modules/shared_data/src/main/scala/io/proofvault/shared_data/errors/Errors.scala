package io.proofvault.shared_data.errors

import cats.syntax.validated._                       // .validNec
import org.tessellation.currency.dataApplication.DataApplicationValidationError
import org.tessellation.currency.dataApplication.dataApplication.DataApplicationValidationErrorOr

object Errors {

  /** Alias idéntico al NFT  */
  type DataApplicationValidationType = DataApplicationValidationErrorOr[Unit]

  /** “Todo OK” para las validaciones */
  val valid: DataApplicationValidationType =
    ().validNec[DataApplicationValidationError]
}

