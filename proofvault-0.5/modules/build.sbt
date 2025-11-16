
import Dependencies._
import sbt.*
import sbt.Keys.*

libraryDependencies ++= Seq(
  tessellationShared,
  tessellationCurrency,
  "io.circe" %% "circe-core" % "0.14.3",
  "io.circe" %% "circe-generic" % "0.14.3",
  "io.circe" %% "circe-parser" % "0.14.3",
  "com.github.julien-truffaut" %% "monocle-core" % "3.2.0",
  "com.github.julien-truffaut" %% "monocle-macro" % "3.2.0",
  CompilerPlugin.kindProjector,
  CompilerPlugin.betterMonadicFor,
  CompilerPlugin.semanticDB,
  Libraries.tessellationCurrencyL1
)

ThisBuild / scalaVersion     := "2.13.10"
ThisBuild / organization     := "io.proofvault"
ThisBuild / version          := "0.2.0-SNAPSHOT"
ThisBuild / evictionErrorLevel := Level.Warn
ThisBuild / scalafixDependencies += Libraries.organizeImports

ThisBuild / assemblyMergeStrategy := {
  case "logback.xml" => MergeStrategy.first
  case x if x.contains("io.netty.versions.properties") => MergeStrategy.discard
  case PathList("com", "proofvault", "buildinfo", xs @ _*) => MergeStrategy.first
  case PathList(xs@_*) if xs.last == "module-info.class" => MergeStrategy.first
  case x =>
    val oldStrategy = (assembly / assemblyMergeStrategy).value
    oldStrategy(x)
}

lazy val commonLibraryDependencies: Seq[ModuleID] = Seq(
  CompilerPlugin.kindProjector,
  CompilerPlugin.betterMonadicFor,
  CompilerPlugin.semanticDB,
  Libraries.tessellationNodeShared,
  Libraries.cats,
  Libraries.catsEffect,
  Libraries.pureconfigCore,
  Libraries.pureconfigCats
)

lazy val commonTestSettings = Seq(
  testFrameworks += new TestFramework("weaver.framework.CatsEffect"),
  libraryDependencies ++= Seq(
    Libraries.weaverCats,
    Libraries.weaverDiscipline,
    Libraries.weaverScalaCheck,
    Libraries.catsEffectTestkit
  ).map(_ % Test)
)

lazy val buildInfoSettings = Seq(
  buildInfoKeys := Seq[BuildInfoKey](
    name,
    version,
    scalaVersion,
    sbtVersion
  ),
  buildInfoPackage := "com.proofvault.buildinfo"
)

lazy val commonSettings = Seq(
  scalacOptions ++= List("-Ymacro-annotations", "-Yrangepos", "-Wconf:cat=unused:info", "-language:reflectiveCalls"),
  resolvers += Resolver.mavenLocal,
  resolvers += Resolver.githubPackages("abankowski", "http-request-signer"),
) ++ Defaults.itSettings

lazy val root = (project in file("."))
  .settings(
    name := "proofvault-root"
  ).aggregate(sharedData, currencyL0, dataL1, currencyL1)

lazy val sharedData = (project in file("modules/shared_data"))
  .enablePlugins(AshScriptPlugin, BuildInfoPlugin, JavaAppPackaging)
  .settings(
    buildInfoSettings,
    commonSettings,
    commonTestSettings,
    name := "proofvault-shared-data",
    libraryDependencies ++= commonLibraryDependencies,
    Compile / mainClass := Some("io.proofvault.shared_data.Main")
  )

lazy val dataL1 = (project in file("modules/data_l1"))
  .enablePlugins(AshScriptPlugin, BuildInfoPlugin, JavaAppPackaging)
  .dependsOn(sharedData)
  .settings(
    name := "proofvault-data_l1",
    scalacOptions ++= List("-Ymacro-annotations", "-Yrangepos",
      "-Wconf:cat=unused:info", "-language:reflectiveCalls"),
    buildInfoKeys    := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "io.proofvault.data_l1",
    resolvers += Resolver.mavenLocal,
    resolvers += Resolver.githubPackages("abankowski", "http-request-signer"),
    Defaults.itSettings,
    libraryDependencies ++= Seq(
      CompilerPlugin.kindProjector,
      CompilerPlugin.betterMonadicFor,
      CompilerPlugin.semanticDB,
      Libraries.tessellationCurrencyL1
    ),
    Compile / mainClass := Some("io.proofvault.data_l1.Main")
  )

lazy val currencyL0 = (project in file("modules/l0"))
  .enablePlugins(AshScriptPlugin, BuildInfoPlugin, JavaAppPackaging)
  .dependsOn(sharedData)
  .settings(
    buildInfoSettings,
    commonSettings,
    commonTestSettings,
    name := "proofvault-l0",
    libraryDependencies ++= (commonLibraryDependencies ++ Seq(Libraries.tessellationCurrencyL0)),
    Compile / mainClass := Some("io.proofvault.l0.Main")
  )

lazy val currencyL1 = (project in file("modules/l1"))
  .enablePlugins(AshScriptPlugin, BuildInfoPlugin, JavaAppPackaging)
  .dependsOn(sharedData)
  .settings(
    buildInfoSettings,
    commonSettings,
    commonTestSettings,
    name := "proofvault-l1",
    libraryDependencies ++= (commonLibraryDependencies ++ Seq(Libraries.tessellationCurrencyL1)),
    Compile / mainClass := Some("io.proofvault.l1.Main")
  )
