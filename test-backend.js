import axios from 'axios';

const API_BASE = 'http://localhost:8081';

async function testBackend() {
  try {
    console.log('Testing backend endpoints...\n');

    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check:', healthResponse.data);

    // Test getting existing documents
    console.log('\n2. Testing get documents...');
    const getDocsResponse = await axios.get(`${API_BASE}/api/context/documents`);
    console.log('✅ Get documents:', getDocsResponse.data);

    // Test adding a new document
    console.log('\n3. Testing add document...');
    const newDoc = {
      title: 'Test Document',
      content: 'This is a test document to verify the API is working correctly.',
      metadata: { test: true }
    };
    
    const addDocResponse = await axios.post(`${API_BASE}/api/context/documents`, newDoc);
    console.log('✅ Add document:', addDocResponse.data);

    // Test getting documents again
    console.log('\n4. Testing get documents after adding...');
    const getDocsResponse2 = await axios.get(`${API_BASE}/api/context/documents`);
    console.log('✅ Get documents (updated):', getDocsResponse2.data);

    console.log('\n🎉 All tests passed! Backend is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the backend is running: npm run dev:backend');
    }
  }
}

testBackend();