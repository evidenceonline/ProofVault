package io.proofvault.shared_data

// import cats.effect.io.IOApp
import cats.effect.{ExitCode, IO, IOApp}
import cats.effect.IO
import cats.effect.ExitCode

object Main extends IOApp {
  def run(args: List[String]): IO[ExitCode] =
    IO.println("Starting shared_data layer...").as(ExitCode.Success)
}