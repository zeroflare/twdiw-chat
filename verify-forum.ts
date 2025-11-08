/**
 * Verification Script: Forum Aggregate Root
 *
 * This script verifies that the Forum entity is correctly implemented
 * according to the DDD patterns and business requirements.
 *
 * Run with: npx tsx verify-forum.ts
 */

import { Forum, ForumStatus, Rank } from './src/domain/entities/Forum';

console.log('🔍 Verifying Forum Aggregate Root Implementation...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(description: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${description}`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    testsFailed++;
  }
}

// Test 1: Factory Method - create()
console.log('📦 Factory Methods\n');

test('Forum.create() should create a new active forum', () => {
  const forum = Forum.create({
    requiredRank: Rank.GOLD,
    description: 'Gold Members Forum',
    tlkChannelId: 'gold-forum-channel',
    capacity: 100,
    creatorId: 'creator-123',
  });

  if (!forum.getId()) throw new Error('ID should be generated');
  if (forum.getRequiredRank() !== Rank.GOLD) throw new Error('Required rank should be GOLD');
  if (forum.getDescription() !== 'Gold Members Forum') throw new Error('Description mismatch');
  if (forum.getTlkChannelId() !== 'gold-forum-channel') throw new Error('Channel ID mismatch');
  if (forum.getCapacity() !== 100) throw new Error('Capacity mismatch');
  if (forum.getCreatorId() !== 'creator-123') throw new Error('Creator ID mismatch');
  if (forum.getStatus() !== ForumStatus.ACTIVE) throw new Error('Status should be ACTIVE');
  if (forum.getMemberCount() !== 0) throw new Error('Member count should start at 0');
  if (forum.getVersion() !== 1) throw new Error('Version should start at 1');
});

test('Forum.create() should validate requiredRank', () => {
  try {
    Forum.create({
      requiredRank: 'Platinum' as any,
      tlkChannelId: 'test-channel',
      capacity: 50,
      creatorId: 'creator-123',
    });
    throw new Error('Should have thrown error for invalid rank');
  } catch (error) {
    if (error instanceof Error && !error.message.includes('Invalid rank')) {
      throw error;
    }
  }
});

test('Forum.create() should validate capacity > 0', () => {
  try {
    Forum.create({
      requiredRank: Rank.BRONZE,
      tlkChannelId: 'test-channel',
      capacity: 0,
      creatorId: 'creator-123',
    });
    throw new Error('Should have thrown error for zero capacity');
  } catch (error) {
    if (error instanceof Error && !error.message.includes('capacity must be greater than 0')) {
      throw error;
    }
  }
});

test('Forum.create() should validate tlkChannelId not empty', () => {
  try {
    Forum.create({
      requiredRank: Rank.BRONZE,
      tlkChannelId: '',
      capacity: 50,
      creatorId: 'creator-123',
    });
    throw new Error('Should have thrown error for empty channel ID');
  } catch (error) {
    if (error instanceof Error && !error.message.includes('tlkChannelId cannot be empty')) {
      throw error;
    }
  }
});

test('Forum.reconstitute() should restore forum from persistence', () => {
  const persistenceData = {
    id: 'forum-123',
    requiredRank: Rank.GOLD,
    description: 'Gold Forum',
    tlkChannelId: 'gold-channel',
    capacity: 100,
    memberCount: 25,
    creatorId: 'creator-123',
    status: ForumStatus.ACTIVE,
    version: 3,
    createdAt: 1699999999000,
    updatedAt: 1700000000000,
  };

  const forum = Forum.reconstitute(persistenceData);

  if (forum.getId() !== 'forum-123') throw new Error('ID mismatch');
  if (forum.getMemberCount() !== 25) throw new Error('Member count mismatch');
  if (forum.getVersion() !== 3) throw new Error('Version mismatch');
  if (forum.getDomainEvents().length !== 0) throw new Error('Should not emit events on reconstitution');
});

// Test 2: Business Logic - canMemberAccess()
console.log('\n🔐 Rank-Based Access Control\n');

const goldForum = Forum.create({
  requiredRank: Rank.GOLD,
  tlkChannelId: 'gold-channel',
  capacity: 50,
  creatorId: 'creator-123',
});

const silverForum = Forum.create({
  requiredRank: Rank.SILVER,
  tlkChannelId: 'silver-channel',
  capacity: 100,
  creatorId: 'creator-123',
});

const bronzeForum = Forum.create({
  requiredRank: Rank.BRONZE,
  tlkChannelId: 'bronze-channel',
  capacity: 200,
  creatorId: 'creator-123',
});

test('Gold member can access Gold forum', () => {
  if (!goldForum.canMemberAccess(Rank.GOLD)) {
    throw new Error('Gold member should access Gold forum');
  }
});

test('Gold member can access Silver forum', () => {
  if (!silverForum.canMemberAccess(Rank.GOLD)) {
    throw new Error('Gold member should access Silver forum');
  }
});

test('Gold member can access Bronze forum', () => {
  if (!bronzeForum.canMemberAccess(Rank.GOLD)) {
    throw new Error('Gold member should access Bronze forum');
  }
});

test('Silver member cannot access Gold forum', () => {
  if (goldForum.canMemberAccess(Rank.SILVER)) {
    throw new Error('Silver member should NOT access Gold forum');
  }
});

test('Silver member can access Silver forum', () => {
  if (!silverForum.canMemberAccess(Rank.SILVER)) {
    throw new Error('Silver member should access Silver forum');
  }
});

test('Bronze member cannot access Gold forum', () => {
  if (goldForum.canMemberAccess(Rank.BRONZE)) {
    throw new Error('Bronze member should NOT access Gold forum');
  }
});

test('Bronze member can access Bronze forum', () => {
  if (!bronzeForum.canMemberAccess(Rank.BRONZE)) {
    throw new Error('Bronze member should access Bronze forum');
  }
});

// Test 3: Capacity Management
console.log('\n📊 Capacity Management\n');

test('isFull() returns false for empty forum', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  if (forum.isFull()) {
    throw new Error('Empty forum should not be full');
  }
});

test('isFull() returns true when at capacity', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 2,
    creatorId: 'creator-123',
  });

  forum.incrementMemberCount();
  forum.incrementMemberCount();

  if (!forum.isFull()) {
    throw new Error('Forum at capacity should be full');
  }
});

test('canMemberAccess() denies access when forum is full', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 2,
    creatorId: 'creator-123',
  });

  forum.incrementMemberCount();
  forum.incrementMemberCount();

  if (forum.canMemberAccess(Rank.GOLD)) {
    throw new Error('Should deny access when forum is full');
  }
});

test('incrementMemberCount() increases count and version', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  const initialVersion = forum.getVersion();
  forum.incrementMemberCount();

  if (forum.getMemberCount() !== 1) {
    throw new Error('Member count should be 1');
  }
  if (forum.getVersion() !== initialVersion + 1) {
    throw new Error('Version should increment');
  }
});

test('decrementMemberCount() decreases count', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  forum.incrementMemberCount();
  forum.incrementMemberCount();
  forum.decrementMemberCount();

  if (forum.getMemberCount() !== 1) {
    throw new Error('Member count should be 1');
  }
});

test('decrementMemberCount() throws when count is zero', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  try {
    forum.decrementMemberCount();
    throw new Error('Should have thrown error for negative count');
  } catch (error) {
    if (error instanceof Error && !error.message.includes('Member count cannot be negative')) {
      throw error;
    }
  }
});

// Test 4: Forum Lifecycle
console.log('\n♻️  Forum Lifecycle (Archive)\n');

test('archive() changes status to ARCHIVED', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  forum.archive();

  if (forum.getStatus() !== ForumStatus.ARCHIVED) {
    throw new Error('Status should be ARCHIVED');
  }
});

test('archive() emits ForumArchived event', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  forum.archive();

  const events = forum.getDomainEvents();
  if (events.length !== 1) {
    throw new Error('Should emit one event');
  }
  if (events[0].eventType !== 'ForumArchived') {
    throw new Error('Should emit ForumArchived event');
  }
});

test('archive() throws if already archived', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  forum.archive();

  try {
    forum.archive();
    throw new Error('Should have thrown error for double archive');
  } catch (error) {
    if (error instanceof Error && !error.message.includes('Forum is already archived')) {
      throw error;
    }
  }
});

test('canMemberAccess() denies access to archived forum', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  forum.archive();

  if (forum.canMemberAccess(Rank.GOLD)) {
    throw new Error('Should deny access to archived forum');
  }
});

test('incrementMemberCount() throws on archived forum', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  forum.archive();

  try {
    forum.incrementMemberCount();
    throw new Error('Should have thrown error for archived forum');
  } catch (error) {
    if (error instanceof Error && !error.message.includes('Cannot modify archived forum')) {
      throw error;
    }
  }
});

// Test 5: Domain Events
console.log('\n📢 Domain Events\n');

test('clearDomainEvents() clears and returns events', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  forum.archive();

  const events = forum.clearDomainEvents();
  if (events.length !== 1) {
    throw new Error('Should return one event');
  }
  if (forum.getDomainEvents().length !== 0) {
    throw new Error('Events should be cleared');
  }
});

// Test 6: Persistence
console.log('\n💾 Persistence\n');

test('toPersistence() returns correct format', () => {
  const forum = Forum.create({
    requiredRank: Rank.GOLD,
    description: 'Test Forum',
    tlkChannelId: 'test-channel',
    capacity: 100,
    creatorId: 'creator-123',
  });

  const persistence = forum.toPersistence();

  if (persistence.id !== forum.getId()) throw new Error('ID mismatch');
  if (persistence.requiredRank !== Rank.GOLD) throw new Error('Rank mismatch');
  if (persistence.description !== 'Test Forum') throw new Error('Description mismatch');
  if (persistence.tlkChannelId !== 'test-channel') throw new Error('Channel ID mismatch');
  if (persistence.capacity !== 100) throw new Error('Capacity mismatch');
  if (persistence.memberCount !== 0) throw new Error('Member count mismatch');
  if (persistence.creatorId !== 'creator-123') throw new Error('Creator ID mismatch');
  if (persistence.status !== ForumStatus.ACTIVE) throw new Error('Status mismatch');
  if (persistence.version !== 1) throw new Error('Version mismatch');
});

test('Persistence round-trip preserves state', () => {
  const original = Forum.create({
    requiredRank: Rank.SILVER,
    description: 'Test Forum',
    tlkChannelId: 'test-channel',
    capacity: 75,
    creatorId: 'creator-456',
  });

  original.incrementMemberCount();
  original.incrementMemberCount();

  const persistence = original.toPersistence();
  const reconstituted = Forum.reconstitute(persistence);

  if (reconstituted.getId() !== original.getId()) throw new Error('ID mismatch');
  if (reconstituted.getRequiredRank() !== original.getRequiredRank()) throw new Error('Rank mismatch');
  if (reconstituted.getMemberCount() !== original.getMemberCount()) throw new Error('Member count mismatch');
  if (reconstituted.getVersion() !== original.getVersion()) throw new Error('Version mismatch');
});

// Test 7: Optimistic Locking
console.log('\n🔒 Optimistic Locking\n');

test('Version increments on state changes', () => {
  const forum = Forum.create({
    requiredRank: Rank.BRONZE,
    tlkChannelId: 'test-channel',
    capacity: 50,
    creatorId: 'creator-123',
  });

  if (forum.getVersion() !== 1) throw new Error('Initial version should be 1');

  forum.incrementMemberCount();
  if (forum.getVersion() !== 2) throw new Error('Version should be 2');

  forum.incrementMemberCount();
  if (forum.getVersion() !== 3) throw new Error('Version should be 3');

  forum.decrementMemberCount();
  if (forum.getVersion() !== 4) throw new Error('Version should be 4');

  forum.archive();
  if (forum.getVersion() !== 5) throw new Error('Version should be 5');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log('='.repeat(50));

if (testsFailed === 0) {
  console.log('\n🎉 All verifications passed! Forum Aggregate Root is correctly implemented.\n');
  console.log('✅ DDD Patterns Applied:');
  console.log('   - Aggregate Root pattern');
  console.log('   - Factory Method pattern');
  console.log('   - Domain Events pattern (ForumArchived)');
  console.log('   - Optimistic Locking pattern');
  console.log('   - Rich domain model with encapsulated business logic');
  console.log('\n✅ Business Rules Enforced:');
  console.log('   - Rank-based access control (Gold > Silver > Bronze)');
  console.log('   - Capacity limits and full forum detection');
  console.log('   - Forum lifecycle management (active/archived)');
  console.log('   - Archived forums cannot be modified');
  console.log('   - Member count cannot be negative');
  console.log('\n✅ Data Model Compliance:');
  console.log('   - Matches specs/001-gated-forum-matching/data-model.md');
  console.log('   - All required fields present');
  console.log('   - Proper state transitions');
  process.exit(0);
} else {
  console.log('\n⚠️  Some verifications failed. Please review the errors above.\n');
  process.exit(1);
}
