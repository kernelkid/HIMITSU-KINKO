/**
 * SECUREVAULT - Web Cryptography Engine
 * AES-256-GCM + PBKDF2 (100,000 iterations, SHA-256)
 * Zero-knowledge: All cryptographic operations execute strictly inside browser RAM.
 */

const CryptoEngine = (function () {
  // Magic envelope header for SecureVault (.enc & .kinko format)
  const MAGIC_HEADER = 'HIMITSU1';
  const SALT_LENGTH = 16;   // 128-bit random salt
  const IV_LENGTH = 12;     // 96-bit AES-GCM IV
  const PBKDF2_ROUNDS = 100000;

  /**
   * Convert byte array to hexadecimal string
   */
  function toHexString(byteArray) {
    return Array.from(byteArray, function (byte) {
      return ('0' + (byte & 0xff).toString(16)).slice(-2);
    }).join('').toUpperCase();
  }

  /**
   * Convert byte size into human readable format
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Derive a 256-bit AES-GCM key from password and salt using PBKDF2
   */
  async function deriveKeyFromPassword(password, salt, iterations = PBKDF2_ROUNDS) {
    const enc = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt an ArrayBuffer with AES-256-GCM
   * Returns a sealed envelope containing [MAGIC (8B)][Salt (16B)][IV (12B)][FilenameLen (2B)][Filename (NB)][Ciphertext + AuthTag]
   */
  async function encryptFile(file, password, onProgress = null) {
    if (!file) throw new Error('No file provided for encryption.');
    if (!password) throw new Error('Encryption password is required.');

    if (onProgress) onProgress(15, 'Reading file into memory buffer...');
    const fileBuffer = await file.arrayBuffer();

    if (onProgress) onProgress(35, 'Generating cryptographic Salt (16B) & IV (12B)...');
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    if (onProgress) onProgress(60, 'Deriving AES-256 key (100,000 PBKDF2 rounds)...');
    const aesKey = await deriveKeyFromPassword(password, salt, PBKDF2_ROUNDS);

    if (onProgress) onProgress(80, 'Encrypting data & computing 128-bit authentication tag...');
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      fileBuffer
    );

    if (onProgress) onProgress(95, 'Sealing cryptographic envelope...');
    const enc = new TextEncoder();
    const filenameBytes = enc.encode(file.name);
    const filenameLen = filenameBytes.length;
    const magicBytes = enc.encode(MAGIC_HEADER);

    const headerLen = 8 + SALT_LENGTH + IV_LENGTH + 2 + filenameLen;
    const totalLength = headerLen + ciphertextBuffer.byteLength;

    const finalBuffer = new Uint8Array(totalLength);
    let offset = 0;

    // Write Magic (8 bytes)
    finalBuffer.set(magicBytes, offset);
    offset += 8;

    // Write Salt (16 bytes)
    finalBuffer.set(salt, offset);
    offset += SALT_LENGTH;

    // Write IV (12 bytes)
    finalBuffer.set(iv, offset);
    offset += IV_LENGTH;

    // Write Filename Length (2 bytes, big-endian uint16)
    finalBuffer[offset] = (filenameLen >> 8) & 0xff;
    finalBuffer[offset + 1] = filenameLen & 0xff;
    offset += 2;

    // Write Filename (UTF-8 bytes)
    finalBuffer.set(filenameBytes, offset);
    offset += filenameLen;

    // Write Ciphertext + GCM Tag
    finalBuffer.set(new Uint8Array(ciphertextBuffer), offset);

    if (onProgress) onProgress(100, 'Envelope sealed successfully!');

    return {
      buffer: finalBuffer,
      saltHex: toHexString(salt),
      ivHex: toHexString(iv),
      originalName: file.name,
      originalSize: file.size,
      encryptedSize: finalBuffer.byteLength
    };
  }

  /**
   * Decrypt an encrypted envelope (.enc / .kinko)
   * Validates header, extracts parameters, verifies 128-bit auth tag, and restores original file
   */
  async function decryptFile(fileOrBuffer, password, onProgress = null) {
    if (!password) throw new Error('Decryption password is required.');

    if (onProgress) onProgress(15, 'Reading encrypted payload...');
    let fileBuffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
      fileBuffer = fileOrBuffer;
    } else if (fileOrBuffer.arrayBuffer) {
      fileBuffer = await fileOrBuffer.arrayBuffer();
    } else {
      throw new Error('Invalid input payload.');
    }

    const dataBytes = new Uint8Array(fileBuffer);
    if (fileBuffer.byteLength < 38) {
      throw new Error('Corrupted or incomplete file format.');
    }

    if (onProgress) onProgress(35, 'Validating cryptographic envelope header...');
    const dec = new TextDecoder();
    const magic = dec.decode(dataBytes.slice(0, 8));
    if (magic !== MAGIC_HEADER) {
      throw new Error('Unsupported format: Missing valid HIMITSU1 / SecureVault header envelope.');
    }

    // Extract Salt & IV
    const salt = dataBytes.slice(8, 24);
    const iv = dataBytes.slice(24, 36);

    // Filename Length & Filename
    const filenameLen = (dataBytes[36] << 8) | dataBytes[37];
    const filenameStart = 38;
    const filenameEnd = filenameStart + filenameLen;

    if (filenameEnd > fileBuffer.byteLength) {
      throw new Error('Malformed header: Filename boundary exceeds file buffer.');
    }

    const originalFilename = dec.decode(dataBytes.slice(filenameStart, filenameEnd));
    const ciphertext = dataBytes.slice(filenameEnd);

    if (onProgress) onProgress(65, 'Deriving key from password (100,000 PBKDF2 rounds)...');
    const aesKey = await deriveKeyFromPassword(password, salt, PBKDF2_ROUNDS);

    if (onProgress) onProgress(85, 'Authenticating tag & decrypting ciphertext...');
    let decryptedBuffer;
    try {
      decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        aesKey,
        ciphertext
      );
    } catch (err) {
      // AES-GCM throws OperationError if password is bad or tag is tampered
      throw new Error('AUTHENTICATION_FAILED: Incorrect password or corrupted/tampered payload.');
    }

    if (onProgress) onProgress(100, 'Integrity verified! File restored.');

    return {
      buffer: decryptedBuffer,
      originalName: originalFilename,
      saltHex: toHexString(salt),
      ivHex: toHexString(iv),
      size: decryptedBuffer.byteLength
    };
  }

  return {
    encryptFile,
    decryptFile,
    toHexString,
    formatBytes,
    MAGIC_HEADER
  };
})();
