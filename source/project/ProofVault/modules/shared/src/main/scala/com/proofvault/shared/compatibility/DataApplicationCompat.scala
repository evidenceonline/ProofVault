package com.proofvault.shared.compatibility

import cats.data.NonEmptyList
import org.tessellation.security.signature.Signed
import org.http4s.HttpRoutes

// Compatibility layer for data application functionality
// This provides the missing types that were removed from Tessellation 2.8.1

// Use standard cats.effect.IO and handle errors via exceptions
type IO[E, A] = cats.effect.IO[A]

// Helper methods for IO
object IO {
  def pure[E, A](a: A): IO[E, A] = cats.effect.IO.pure(a)
  def unit[E]: IO[E, Unit] = cats.effect.IO.unit
  def raiseError[E, A](e: E): IO[E, A] = cats.effect.IO.raiseError(new RuntimeException(e.toString))
}

// Base data update trait
trait DataUpdate

// Base data state trait
trait DataState[S <: DataState[S, U], U <: DataUpdate] {
  def applyUpdate(update: U): S
}

// Calculated state trait
trait DataCalculatedState

// On-chain state trait  
trait OnChainState

// Validation error
case class DataApplicationValidationError(message: String) extends Exception(message)

// Simplified context - this would need to be properly implemented
// For now, just a placeholder to allow compilation
case class L1NodeContext[F[_]](getLastSnapshot: SnapshotInfo) {
  // Placeholder implementation
}

case class SnapshotInfo(ordinal: Long)

object DataApplicationCompat {
  // Export all types for easy importing
  type DataUpdate = com.proofvault.shared.compatibility.DataUpdate
  type DataState[S <: DataState[S, U], U <: DataUpdate] = com.proofvault.shared.compatibility.DataState[S, U]
  type DataCalculatedState = com.proofvault.shared.compatibility.DataCalculatedState  
  type OnChainState = com.proofvault.shared.compatibility.OnChainState
  type DataApplication[U <: DataUpdate, S <: DataState[S, U], CS <: DataCalculatedState, OS <: OnChainState] = com.proofvault.shared.compatibility.DataApplication[U, S, CS, OS]
  type DataApplicationValidationError = com.proofvault.shared.compatibility.DataApplicationValidationError
  type L1NodeContext[F[_]] = com.proofvault.shared.compatibility.L1NodeContext[F]
  
  val DataApplicationValidationError = com.proofvault.shared.compatibility.DataApplicationValidationError
}

// Base data application service
abstract class BaseDataApplicationL1Service[F[_]] {
  def validateUpdate(update: DataUpdate, state: OnChainState): cats.effect.IO[Unit]
  def validateData(updates: NonEmptyList[Signed[DataUpdate]]): cats.effect.IO[Unit] 
  def combine(state: OnChainState, updates: List[Signed[DataUpdate]]): cats.effect.IO[OnChainState]
  def routes: HttpRoutes[F]
}

// Data application trait
trait DataApplication[U <: DataUpdate, S <: DataState[S, U], CS <: DataCalculatedState, OS <: OnChainState] {
  def name: String
  def validateUpdate(state: DataState[S, U], update: U)(implicit context: L1NodeContext[Any]): IO[DataApplicationValidationError, Unit]
  def validateData(state: DataState[S, U], updates: NonEmptyList[Signed[U]])(implicit context: L1NodeContext[Any]): IO[DataApplicationValidationError, Unit]
  def combine(state: DataState[S, U], updates: List[Signed[U]])(implicit context: L1NodeContext[Any]): IO[DataApplicationValidationError, S]
  def getCalculatedState(state: DataState[S, U])(implicit context: L1NodeContext[Any]): IO[DataApplicationValidationError, CS]
  def getOnChainState(state: DataState[S, U])(implicit context: L1NodeContext[Any]): IO[DataApplicationValidationError, OS]
  def genesis: DataState[S, U]
  
  // Serialization methods (placeholder implementations)
  def serializeState(state: DataState[S, U]): IO[DataApplicationValidationError, Array[Byte]]
  def deserializeState(bytes: Array[Byte]): IO[DataApplicationValidationError, DataState[S, U]]
  def serializeUpdate(update: U): IO[DataApplicationValidationError, Array[Byte]]
  def deserializeUpdate(bytes: Array[Byte]): IO[DataApplicationValidationError, U]
  def serializeCalculatedState(state: DataCalculatedState): IO[DataApplicationValidationError, Array[Byte]]
  def deserializeCalculatedState(bytes: Array[Byte]): IO[DataApplicationValidationError, DataCalculatedState]
  def serializeOnChainState(state: OnChainState): IO[DataApplicationValidationError, Array[Byte]]
  def deserializeOnChainState(bytes: Array[Byte]): IO[DataApplicationValidationError, OnChainState]
  def hashCalculatedState(state: DataCalculatedState)(implicit context: L1NodeContext[Any]): IO[DataApplicationValidationError, org.tessellation.security.hash.Hash]
  
  // HTTP routes for the data application
  def routes[F[_]](implicit context: L1NodeContext[F]): HttpRoutes[F]
}