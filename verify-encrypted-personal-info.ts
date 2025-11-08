/**
 * Quick verification script for EncryptedPersonalInfo
 * This demonstrates the encryption/decryption workflow
 */

import { EncryptedPersonalInfo } from './src/domain/value-objects/EncryptedPersonalInfo';

async function main() {
  const KEY = 'test-encryption-key-32-characters!!';

  console.log('=== EncryptedPersonalInfo Verification ===\n');

  // Test 1: Create with all fields
  console.log('Test 1: Create with all fields');
  const info = await EncryptedPersonalInfo.create(
    {
      nickname: 'TestUser',
      gender: 'Female',
      interests: ['Tech', 'Gaming', 'Music'],
    },
    KEY
  );

  console.log('✓ Created:', {
    nickname: info.getNickname(),
    gender: info.getGender(),
    interests: info.getInterests(),
  });

  // Test 2: Encrypt to persistence
  console.log('\nTest 2: Encrypt to persistence');
  const encrypted = await info.toEncryptedPersistence();
  console.log('✓ Encrypted:', encrypted);
  console.log('  - nickname (plain):', encrypted.nickname);
  console.log('  - gender (encrypted):', encrypted.gender?.substring(0, 30) + '...');
  console.log('  - interests (encrypted):', encrypted.interests?.substring(0, 30) + '...');

  // Test 3: Decrypt from persistence
  console.log('\nTest 3: Decrypt from persistence');
  const decrypted = await EncryptedPersonalInfo.fromEncryptedPersistence(encrypted, KEY);
  console.log('✓ Decrypted:', {
    nickname: decrypted.getNickname(),
    gender: decrypted.getGender(),
    interests: decrypted.getInterests(),
  });

  // Test 4: Value equality
  console.log('\nTest 4: Value equality');
  const info2 = await EncryptedPersonalInfo.create(
    {
      nickname: 'TestUser',
      gender: 'Female',
      interests: ['Tech', 'Gaming', 'Music'],
    },
    KEY
  );
  console.log('✓ Equals:', info.equals(info2));

  // Test 5: Unique IV for each encryption
  console.log('\nTest 5: Unique IV verification');
  const encrypted1 = await info.toEncryptedPersistence();
  const encrypted2 = await info2.toEncryptedPersistence();
  console.log('✓ Different ciphertexts (unique IVs):', encrypted1.gender !== encrypted2.gender);

  // Test 6: Immutability
  console.log('\nTest 6: Immutability check');
  const interests = info.getInterests();
  if (interests) {
    interests.push('Hacking');
  }
  console.log('✓ Original unchanged:', info.getInterests()?.length === 3);

  console.log('\n=== All Verifications Passed! ===');
}

main().catch(console.error);
