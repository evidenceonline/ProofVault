import Dependencies.*
import sbt.*

ThisBuild / organization := "com.proofvault"
ThisBuild / scalaVersion := "2.13.10"
ThisBuild / evictionErrorLevel := Level.Warn
ThisBuild / resolvers += Resolver.mavenLocal

ThisBuild / assemblyMergeStrategy := {
  case "logback.xml" => MergeStrategy.first
  case x if x.contains("io.netty.versions.properties") => MergeStrategy.discard
  case PathList(xs@_*) if xs.last == "module-info.class" => MergeStrategy.first
  case x =>
    val oldStrategy = (assembly / assemblyMergeStrategy).value
    oldStrategy(x)
}

lazy val root = (project in file(".")).
  settings(
    name := "proofvault"
  ).aggregate(shared, currencyL0, currencyL1, dataL1)

lazy val shared = (project in file("modules/shared"))
  .settings(
    name := "proofvault-shared",
    scalacOptions ++= List("-Ymacro-annotations"),
    resolvers += Resolver.mavenLocal,
    libraryDependencies ++= Seq(
      CompilerPlugin.kindProjector,
      CompilerPlugin.betterMonadicFor,
      CompilerPlugin.semanticDB,
      Libraries.tessellationNodeShared.exclude("pl.abankowski", "http4s-request-signer_2.13").exclude("pl.abankowski", "http-request-signer-core_2.13"),
      Libraries.derevoCore,
      Libraries.derevoCats,
      Libraries.derevoCirce
    )
  )

lazy val currencyL1 = (project in file("modules/l1"))
  .enablePlugins(AshScriptPlugin)
  .enablePlugins(BuildInfoPlugin)
  .enablePlugins(JavaAppPackaging)
  .dependsOn(shared)
  .settings(
    name := "proofvault-currency-l1",
    scalacOptions ++= List("-Ymacro-annotations"),
    buildInfoKeys := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "com.proofvault.l1",
    resolvers += Resolver.mavenLocal,
    Defaults.itSettings,
    libraryDependencies ++= Seq(
      CompilerPlugin.kindProjector,
      CompilerPlugin.betterMonadicFor,
      CompilerPlugin.semanticDB,
      Libraries.tessellationCurrencyL1.exclude("pl.abankowski", "http4s-request-signer_2.13").exclude("pl.abankowski", "http-request-signer-core_2.13"),
      Libraries.scalaTest
    )
  )

lazy val currencyL0 = (project in file("modules/l0"))
  .enablePlugins(AshScriptPlugin)
  .enablePlugins(BuildInfoPlugin)
  .enablePlugins(JavaAppPackaging)
  .dependsOn(shared)
  .settings(
    name := "proofvault-currency-l0",
    scalacOptions ++= List("-Ymacro-annotations"),
    buildInfoKeys := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "com.proofvault.l0",
    resolvers += Resolver.mavenLocal,
    Defaults.itSettings,
    libraryDependencies ++= Seq(
      CompilerPlugin.kindProjector,
      CompilerPlugin.betterMonadicFor,
      CompilerPlugin.semanticDB,
      Libraries.declineRefined,
      Libraries.declineCore,
      Libraries.declineEffect,
      Libraries.tessellationCurrencyL0.exclude("pl.abankowski", "http4s-request-signer_2.13").exclude("pl.abankowski", "http-request-signer-core_2.13"),
      Libraries.requests
    )
  )

lazy val dataL1 = (project in file("modules/data_l1"))
  .enablePlugins(AshScriptPlugin)
  .enablePlugins(BuildInfoPlugin)
  .enablePlugins(JavaAppPackaging)
  .dependsOn(shared)
  .settings(
    name := "proofvault-data-l1",
    scalacOptions ++= List("-Ymacro-annotations"),
    buildInfoKeys := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "com.proofvault.data_l1",
    resolvers += Resolver.mavenLocal,
    Defaults.itSettings,
    libraryDependencies ++= Seq(
      CompilerPlugin.kindProjector,
      CompilerPlugin.betterMonadicFor,
      CompilerPlugin.semanticDB,
      Libraries.tessellationCurrencyL1.exclude("pl.abankowski", "http4s-request-signer_2.13").exclude("pl.abankowski", "http-request-signer-core_2.13")
    )
  )
