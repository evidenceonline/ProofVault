// Submit hash to Constellation Digital Evidence API for tamper-proof verification
const submitToBlockchain = async (recordId, pdfHash, filename, companyName) => {
  try {
    console.log(`📄 Submitting PDF evidence to Digital Evidence API for record: ${recordId}`);

    // Submit fingerprint to Constellation Digital Evidence API
    const result = await digitalEvidenceClient.submitFingerprint({
      documentRef: pdfHash,
      eventId: recordId,
      documentId: filename,
      metadata: {
        company: companyName,
        filename: filename
      }
    });

    // Update database with Digital Evidence fingerprint information
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE pdf_records SET
         blockchain_tx_id = $1,
         blockchain_status = $2,
         blockchain_verified_at = NOW()
         WHERE id = $3`,
        [result.fingerprintHash, 'submitted', recordId]
      );

      console.log(`✅ Digital Evidence submission successful for record ${recordId}`);
      console.log(`🔍 Explorer URL: ${result.explorerUrl}`);
      console.log(`🆔 Fingerprint Hash: ${result.fingerprintHash}`);

      return true;

    } catch (dbError) {
      console.error('Failed to update database with Digital Evidence info:', dbError);
      return false;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Digital Evidence submission failed:', error);

    // Mark as failed in database
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE pdf_records SET blockchain_status = $1 WHERE id = $2',
        ['failed', recordId]
      );
    } catch (dbError) {
      console.error('Failed to update failure status:', dbError);
    } finally {
      client.release();
    }

    throw error;
  }
};