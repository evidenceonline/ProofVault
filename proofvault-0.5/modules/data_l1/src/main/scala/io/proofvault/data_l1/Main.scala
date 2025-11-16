package io.proofvault.data_l1

import cats.data.NonEmptyList
import cats.effect.{IO, Resource, Ref}
import cats.syntax.all._
import io.circe.{Decoder, Encoder, Json}
import io.circe.syntax._
import org.http4s._
import org.http4s.circe._
import org.http4s.dsl.Http4sDsl
import org.tessellation.BuildInfo
import org.tessellation.currency.dataApplication._
import org.tessellation.currency.dataApplication.dataApplication._
import org.tessellation.currency.l1.CurrencyL1App
import org.tessellation.schema.SnapshotOrdinal
import org.tessellation.schema.cluster.ClusterId
import org.tessellation.schema.semver.{MetagraphVersion, TessellationVersion}
import org.tessellation.security.hash.Hash
import org.tessellation.security.signature.Signed

import java.util.UUID

import io.proofvault.shared_data.errors.Errors.valid
import io.proofvault.shared_data.model.TextUpdate
import io.proofvault.shared_data.types.{EvidenceRecord, EvidenceOnChainState, EvidenceCalculatedState}

/* ───────────────────── Nodo L1 ───────────────────── */
object Main
    extends CurrencyL1App(
      "proofvault-data_l1",
      "ProofVault data L1 node",
      ClusterId(UUID.fromString("517c3a05-9219-471b-a54c-21b7d72f4ae5")),
      TessellationVersion.unsafeFrom(BuildInfo.version),
      MetagraphVersion.unsafeFrom(BuildInfo.version)
    ) {

  /* ─────────── Data-application (patrón NFT) ─────────── */
  private def makeTextService(repo: Repo[IO], calculatedStateRef: Ref[IO, (SnapshotOrdinal, EvidenceCalculatedState)]) = new DataApplicationL1Service[
    IO,
    TextUpdate,
    EvidenceOnChainState,
    EvidenceCalculatedState
  ] {

    /* ----- validaciones ----- */
    def validateData(
        s: DataState[EvidenceOnChainState, EvidenceCalculatedState],
        u: NonEmptyList[Signed[TextUpdate]]
    )(implicit ctx: L1NodeContext[IO]) = valid.pure[IO]

    def validateUpdate(
        u: TextUpdate
    )(implicit ctx: L1NodeContext[IO]) = valid.pure[IO]

    /* ----- combine with evidence tracking ----- */
    def combine(
        s: DataState[EvidenceOnChainState, EvidenceCalculatedState],
        u: List[Signed[TextUpdate]]
    )(implicit ctx: L1NodeContext[IO]) = {
      val newEvidence = u.map(_.value).map(EvidenceRecord.fromTextUpdate).map(e => e.id -> e).toMap
      val updatedOnChain = s.onChain.copy(pendingEvidence = s.onChain.pendingEvidence ++ newEvidence)
      val updatedCalculated = s.calculated.copy(
        totalEvidence = s.calculated.totalEvidence + u.size,
        lastSnapshotOrdinal = s.calculated.lastSnapshotOrdinal + 1
      )
      DataState(updatedOnChain, updatedCalculated).pure[IO]
    }

    /* ----- apply: guarda en el repo y actualiza estado ----- */
    def applyUpdates(
        s: DataState[EvidenceOnChainState, EvidenceCalculatedState],
        u: NonEmptyList[Signed[TextUpdate]]
    )(implicit ctx: L1NodeContext[IO]) =
      u.toList.traverse_(x => repo.put(x.value))

    def routes(implicit ctx: L1NodeContext[IO]) = {
      val dsl = new Http4sDsl[IO] {}; import dsl._
      import org.http4s.server.middleware.CORS
      import io.circe.generic.auto._
      
      // Add implicit EntityDecoder for TextUpdate
      implicit val textUpdateDecoder: EntityDecoder[IO, TextUpdate] = jsonOf[IO, TextUpdate]
      
      val customRoutes = HttpRoutes.of[IO] {
        case GET -> Root / "text" / id =>
          repo.get(id).flatMap {
            case Some(tu) => Ok(tu.asJson)
            case None     => NotFound()
          }
          
        case req @ POST -> Root / "text" =>
          req.as[TextUpdate].flatMap { textUpdate =>
            repo.put(textUpdate) *> Created(textUpdate.asJson)
          }
      }
      
      // Apply CORS middleware like in the working examples
      CORS.policy
        .withAllowCredentials(false)
        .httpRoutes(customRoutes)
    }

    /* ----- serialización ----- */
    def serializeState(s: EvidenceOnChainState) = IO {
      implicitly[Encoder[EvidenceOnChainState]].apply(s).deepDropNullValues.noSpaces.getBytes(java.nio.charset.StandardCharsets.UTF_8)
    }
    def deserializeState(b: Array[Byte]) = IO {
      val jsonString = new String(b, java.nio.charset.StandardCharsets.UTF_8)
      io.circe.parser.decode[EvidenceOnChainState](jsonString)
    }
    def serializeCalculatedState(s: EvidenceCalculatedState) = IO {
      implicitly[Encoder[EvidenceCalculatedState]].apply(s).deepDropNullValues.noSpaces.getBytes(java.nio.charset.StandardCharsets.UTF_8)
    }
    def deserializeCalculatedState(b: Array[Byte]) = IO {
      val jsonString = new String(b, java.nio.charset.StandardCharsets.UTF_8)
      io.circe.parser.decode[EvidenceCalculatedState](jsonString)
    }
    def serializeUpdate(u: TextUpdate) = IO {
      // Critical: Use Constellation's data signing format
      val encoder = java.util.Base64.getEncoder
      val data_sign_prefix = "\u0019Constellation Signed Data:\n"
      
      val updateBytes = implicitly[Encoder[TextUpdate]].apply(u).deepDropNullValues.noSpaces.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      val encodedBytes = encoder.encode(updateBytes)
      
      val encodedString = new String(encodedBytes, "UTF-8")
      val completeString = s"$data_sign_prefix${encodedString.length}\n$encodedString"
      
      completeString.getBytes(java.nio.charset.StandardCharsets.UTF_8)
    }
    def deserializeUpdate(b: Array[Byte])                      = IO.pure(Right(TextUpdate("", "")))
    def serializeBlock(b: Signed[DataApplicationBlock])        = IO.pure(Array.emptyByteArray)
    def deserializeBlock(b: Array[Byte]) =
      IO.pure(Left(new UnsupportedOperationException("not used")))

    /* ----- calculated-state con evidencia ----- */
    def getCalculatedState(implicit ctx: L1NodeContext[IO]) =
      calculatedStateRef.get

    def setCalculatedState(
        o: SnapshotOrdinal,
        s: EvidenceCalculatedState
    )(implicit ctx: L1NodeContext[IO]) = 
      calculatedStateRef.set((o, s)).as(true)

    def hashCalculatedState(
        s: EvidenceCalculatedState
    )(implicit ctx: L1NodeContext[IO]) = IO {
      val stateJson = implicitly[Encoder[EvidenceCalculatedState]].apply(s).deepDropNullValues.noSpaces
      Hash(java.security.MessageDigest.getInstance("SHA-256").digest(stateJson.getBytes()).map("%02x".format(_)).mkString)
    }

    /* ----- encoders/decoders ----- */
    def dataEncoder            = implicitly[Encoder[TextUpdate]]
    def dataDecoder            = implicitly[Decoder[TextUpdate]]
    def calculatedStateEncoder = implicitly[Encoder[EvidenceCalculatedState]]
    def calculatedStateDecoder = implicitly[Decoder[EvidenceCalculatedState]]

    /* ----- firmado ----- */
    def signedDataEntityDecoder: EntityDecoder[IO, Signed[TextUpdate]] =
      jsonOf[IO, Signed[TextUpdate]]
  }

  /* Registro en el nodo */
  override val dataApplication: Option[Resource[IO, BaseDataApplicationL1Service[IO]]] =
    Some(for {
      repo <- Resource.eval(InMemoryRepo.create[IO])
      calculatedStateRef <- Resource.eval(Ref.of[IO, (SnapshotOrdinal, EvidenceCalculatedState)]((SnapshotOrdinal.MinValue, EvidenceCalculatedState.genesis)))
      textService = makeTextService(repo, calculatedStateRef)
      textApp = BaseDataApplicationL1Service(textService)
    } yield textApp)
}
