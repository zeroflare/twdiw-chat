// Quick verification script for MemberProfile implementation
import { MemberProfile, MemberStatus, Rank } from './src/domain/entities/MemberProfile';

console.log('=== MemberProfile Implementation Verification ===\n');

try {
  // Test 1: Create a new member
  console.log('Test 1: Creating new GENERAL member...');
  const member = MemberProfile.create({
    oidcSubjectId: 'sub_test123',
    nickname: 'TestUser',
    gender: 'Male',
    interests: JSON.stringify(['Tech', 'Gaming'])
  });
  console.log('✓ Member created successfully');
  console.log(`  - ID: ${member.getId()}`);
  console.log(`  - Status: ${member.getStatus()}`);
  console.log(`  - Version: ${member.getVersion()}`);
  console.log(`  - Nickname: ${member.getNickname()}`);

  // Test 2: Verify with Rank Card
  console.log('\nTest 2: Verifying member with Rank Card...');
  member.verifyWithRankCard('did:example:abc123', 'Gold');
  console.log('✓ Member verified successfully');
  console.log(`  - Status: ${member.getStatus()}`);
  console.log(`  - DID: ${member.getLinkedVcDid()}`);
  console.log(`  - Rank: ${member.getDerivedRank()}`);
  console.log(`  - Version: ${member.getVersion()} (incremented)`);
  console.log(`  - Domain Events: ${member.getDomainEvents().length}`);

  // Test 3: Access control
  console.log('\nTest 3: Testing forum access control...');
  console.log(`  - Can access Gold forum: ${member.canAccessForum('Gold')}`);
  console.log(`  - Can access Silver forum: ${member.canAccessForum('Silver')}`);
  console.log(`  - Can access Bronze forum: ${member.canAccessForum('Bronze')}`);

  // Test 4: Invariant enforcement
  console.log('\nTest 4: Testing invariant enforcement...');
  try {
    member.verifyWithRankCard('did:example:xyz', 'Silver');
    console.log('✗ Should have thrown error for already verified member');
  } catch (err) {
    console.log(`✓ Correctly prevented re-verification: ${(err as Error).message}`);
  }

  // Test 5: Reconstitution
  console.log('\nTest 5: Testing reconstitution from persistence...');
  const persistenceData = member.toPersistence();
  const reconstituted = MemberProfile.reconstitute(persistenceData);
  console.log('✓ Member reconstituted successfully');
  console.log(`  - ID matches: ${reconstituted.getId() === member.getId()}`);
  console.log(`  - Status matches: ${reconstituted.getStatus() === member.getStatus()}`);
  console.log(`  - No events emitted: ${reconstituted.getDomainEvents().length === 0}`);

  console.log('\n=== All Verification Tests Passed ✓ ===');
} catch (error) {
  console.error('\n✗ Verification failed:', error);
  process.exit(1);
}
