import sbt.*

object Dependencies {

  object V {
    val tessellation = "2.8.1"
    val decline = "2.4.1"
  }

  def tessellation(artifact: String): ModuleID = "org.constellation" %% s"tessellation-$artifact" % V.tessellation

  def decline(artifact: String = ""): ModuleID =
    "com.monovore" %% {
      if (artifact.isEmpty) "decline" else s"decline-$artifact"
    } % V.decline

  object Libraries {
    val tessellationNodeShared = tessellation("node-shared")
    val tessellationCurrencyL0 = tessellation("currency-l0")
    val tessellationCurrencyL1 = tessellation("currency-l1")
    val tessellationCurrencyDataApplication = tessellation("currency-data-application")
    val requests = "com.lihaoyi" %% "requests" % "0.8.0"
    val declineCore = decline()
    val declineEffect = decline("effect")
    val declineRefined = decline("refined")
    val derevoCore = "tf.tofu" %% "derevo-core" % "0.13.0"
    val derevoCats = "tf.tofu" %% "derevo-cats" % "0.13.0"
    val derevoCirce = "tf.tofu" %% "derevo-circe-magnolia" % "0.13.0"
    val scalaTest = "org.scalatest" %% "scalatest" % "3.2.17" % Test
  }


  // Scalafix rules
  val organizeImports = "com.github.liancheng" %% "organize-imports" % "0.5.0"

  object CompilerPlugin {

    val betterMonadicFor = compilerPlugin(
      "com.olegpy" %% "better-monadic-for" % "0.3.1"
    )

    val kindProjector = compilerPlugin(
      ("org.typelevel" % "kind-projector" % "0.13.2").cross(CrossVersion.full)
    )

    val semanticDB = compilerPlugin(
      ("org.scalameta" % "semanticdb-scalac" % "4.7.1").cross(CrossVersion.full)
    )
  }
}
