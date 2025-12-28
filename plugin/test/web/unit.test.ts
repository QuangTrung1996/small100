/**
 * Unit Tests for Small100 Web Modules
 * Run with: npx ts-node test/web/unit.test.ts
 */

import { SimpleBPETokenizer } from '../../src/web/SimpleBPETokenizer';
import { BeamSearchDecoder } from '../../src/web/BeamSearchDecoder';

// Mock vocab for testing
const mockVocab: Record<string, number> = {
  '<s>': 0,
  '<pad>': 1,
  '</s>': 2,
  '<unk>': 3,
  '▁': 4,
  '▁hello': 5,
  '▁world': 6,
  '▁xin': 7,
  '▁chào': 8,
  'h': 9,
  'e': 10,
  'l': 11,
  'o': 12,
};

// Test helper
function assertEqual<T>(actual: T, expected: T, testName: string): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? '✓' : '✗'} ${testName}`);
  if (!pass) {
    console.log(`  Expected: ${JSON.stringify(expected)}`);
    console.log(`  Actual:   ${JSON.stringify(actual)}`);
  }
}

// Tests for SimpleBPETokenizer
function testTokenizer(): void {
  console.log('\n=== SimpleBPETokenizer Tests ===\n');
  
  const tokenizer = new SimpleBPETokenizer(mockVocab);
  
  // Test 1: Encode simple text
  const encoded = tokenizer.encode('hello world');
  console.log('Encoded "hello world":', encoded);
  assertEqual(encoded.includes(5), true, 'encode: should find "▁hello" token');
  assertEqual(encoded.includes(6), true, 'encode: should find "▁world" token');
  
  // Test 2: Decode tokens
  const decoded = tokenizer.decode([5, 6]);
  assertEqual(decoded, 'hello world', 'decode: basic decode');
  
  // Test 3: Skip special tokens
  const decodedWithSpecial = tokenizer.decode([0, 5, 6, 2], true);
  assertEqual(decodedWithSpecial, 'hello world', 'decode: skip special tokens');
  
  // Test 4: Vocab size
  assertEqual(tokenizer.vocabSize, Object.keys(mockVocab).length, 'vocabSize: correct count');
  
  // Test 5: Special token IDs
  assertEqual(tokenizer.bosTokenId, 0, 'bosTokenId: should be 0');
  assertEqual(tokenizer.eosTokenId, 2, 'eosTokenId: should be 2');
  assertEqual(tokenizer.padTokenId, 1, 'padTokenId: should be 1');
  
  // Test 6: Single token decode
  assertEqual(tokenizer.decodeToken(5), '▁hello', 'decodeToken: single token');
  assertEqual(tokenizer.decodeToken(9999), '<unknown>', 'decodeToken: unknown ID');
}

// Tests for BeamSearchDecoder
async function testBeamSearchDecoder(): Promise<void> {
  console.log('\n=== BeamSearchDecoder Tests ===\n');
  
  const decoder = new BeamSearchDecoder({
    numBeams: 2,
    maxLength: 10,
    eosTokenId: 2,
    padTokenId: 1,
  });
  
  // Mock logits callback - always returns high score for token 5, then EOS
  let step = 0;
  const mockGetLogits = async (inputIds: number[][]): Promise<Float32Array[]> => {
    return inputIds.map(() => {
      const logits = new Float32Array(10).fill(-10);
      if (step < 2) {
        logits[5] = 0; // High score for token 5
      } else {
        logits[2] = 0; // EOS token
      }
      step++;
      return logits;
    });
  };
  
  // Test 1: Basic decode
  const result = await decoder.decode([0, 100], mockGetLogits);
  console.log('Decoded result:', result);
  assertEqual(result.length > 0, true, 'decode: should produce output');
  assertEqual(result.includes(2), false, 'decode: should not include EOS in output');
  
  console.log('\n✓ BeamSearchDecoder tests completed');
}

// Test language token extraction
function testLanguageTokenExtraction(): void {
  console.log('\n=== Language Token Extraction Tests ===\n');
  
  const addedTokens = [
    { id: 250001, content: '__en__' },
    { id: 250002, content: '__vi__' },
    { id: 250003, content: '__ja__' },
  ];
  
  const enId = SimpleBPETokenizer.getLanguageTokenId(addedTokens, 'en');
  assertEqual(enId, 250001, 'getLanguageTokenId: English');
  
  const viId = SimpleBPETokenizer.getLanguageTokenId(addedTokens, 'vi');
  assertEqual(viId, 250002, 'getLanguageTokenId: Vietnamese');
  
  const unknownId = SimpleBPETokenizer.getLanguageTokenId(addedTokens, 'xx');
  assertEqual(unknownId, null, 'getLanguageTokenId: Unknown language');
}

// Run all tests
async function runTests(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Small100 Web Modules - Unit Tests     ║');
  console.log('╚════════════════════════════════════════╝');
  
  testTokenizer();
  await testBeamSearchDecoder();
  testLanguageTokenExtraction();
  
  console.log('\n════════════════════════════════════════');
  console.log('All tests completed!');
}

runTests().catch(console.error);
