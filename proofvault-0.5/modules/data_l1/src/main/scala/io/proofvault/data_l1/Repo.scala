package io.proofvault.data_l1

import cats.effect.Sync
import cats.effect.Ref
import cats.syntax.all._
import io.proofvault.shared_data.model.TextUpdate

trait Repo[F[_]] {
  def put(tu: TextUpdate): F[Unit]
  def get(id: String): F[Option[TextUpdate]]
}

object InMemoryRepo {
  def create[F[_]: Sync]: F[Repo[F]] =
    Ref.of[F, Map[String, String]](Map.empty).map { ref =>
      new Repo[F] {
        def put(tu: TextUpdate): F[Unit] = ref.update(_.updated(tu.id, tu.hash))
        def get(id: String): F[Option[TextUpdate]] = ref.get.map(_.get(id).map(TextUpdate(id, _)))
      }
    }
}