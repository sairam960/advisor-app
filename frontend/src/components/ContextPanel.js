'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ContextPanel({ sessionId, onContextChange }) {
  const [documents, setDocuments] = useState([]);
  const [sessionContext, setSessionContext] = useState([]);
  const [newDocument, setNewDocument] = useState({ title: '', content: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');

  useEffect(() => {
    fetchDocuments();
    if (sessionId) {
      fetchSessionContext();
    }
  }, [sessionId]);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('/api/context/documents');
      if (response.data.success) {
        setDocuments(response.data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchSessionContext = async () => {
    try {
      const response = await axios.get(`/api/chat/${sessionId}/context`);
      if (response.data.success) {
        setSessionContext(response.data.contextDocuments);
        onContextChange?.(response.data.contextDocuments);
      }
    } catch (error) {
      console.error('Error fetching session context:', error);
    }
  };

  const addDocument = async (e) => {
    e.preventDefault();
    if (!newDocument.title.trim() || !newDocument.content.trim()) return;

    setIsLoading(true);
    try {
      console.log('Adding document:', newDocument);
      const response = await axios.post('/api/context/documents', newDocument);
      console.log('Add document response:', response.data);
      
      if (response.data.success) {
        setNewDocument({ title: '', content: '' });
        fetchDocuments();
        setActiveTab('browse');
        alert('Document added successfully!');
      } else {
        alert('Failed to add document: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding document:', error);
      alert('Error adding document: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const addToConversation = async (documentId) => {
    try {
      const response = await axios.post(`/api/chat/${sessionId}/context`, {
        documentIds: [documentId],
        relevanceScore: 0.8
      });
      if (response.data.success) {
        fetchSessionContext();
      }
    } catch (error) {
      console.error('Error adding to conversation:', error);
    }
  };

  const removeFromConversation = async (documentId) => {
    try {
      await axios.delete(`/api/chat/${sessionId}/context/${documentId}`);
      fetchSessionContext();
    } catch (error) {
      console.error('Error removing from conversation:', error);
    }
  };

  const deleteDocument = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await axios.delete(`/api/context/documents/${documentId}`);
      if (response.data.success) {
        fetchDocuments();
        fetchSessionContext();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  return (
    <div className="context-panel">
      <div className="context-header">
        <h3>Context Management</h3>
        <div className="tab-buttons">
          <button 
            className={`tab-button ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            Browse ({documents.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active ({sessionContext.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            Add New
          </button>
        </div>
      </div>

      <div className="context-content">
        {activeTab === 'browse' && (
          <div className="documents-list">
            {documents.length === 0 ? (
              <p className="empty-state">No documents available</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="document-item">
                  <div className="document-header">
                    <h4>{doc.title}</h4>
                    <div className="document-actions">
                      {sessionId && !sessionContext.find(c => c.id === doc.id) && (
                        <button 
                          onClick={() => addToConversation(doc.id)}
                          className="action-button add"
                        >
                          Add
                        </button>
                      )}
                      <button 
                        onClick={() => deleteDocument(doc.id)}
                        className="action-button delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="document-content">
                    {doc.content.length > 150 
                      ? doc.content.substring(0, 150) + '...'
                      : doc.content
                    }
                  </p>
                  <div className="document-meta">
                    Added: {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'active' && (
          <div className="active-context">
            {sessionContext.length === 0 ? (
              <p className="empty-state">No context added to this conversation</p>
            ) : (
              sessionContext.map((doc) => (
                <div key={doc.id} className="context-item">
                  <div className="context-header">
                    <h4>{doc.title}</h4>
                    <button 
                      onClick={() => removeFromConversation(doc.id)}
                      className="action-button remove"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="context-content">
                    {doc.content.length > 100 
                      ? doc.content.substring(0, 100) + '...'
                      : doc.content
                    }
                  </p>
                  <div className="context-meta">
                    Relevance: {(doc.relevance_score * 100).toFixed(0)}%
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <form onSubmit={addDocument} className="add-document-form">
            <div className="form-group">
              <label htmlFor="title">Title:</label>
              <input
                id="title"
                type="text"
                value={newDocument.title}
                onChange={(e) => setNewDocument(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter document title"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="content">Content:</label>
              <textarea
                id="content"
                value={newDocument.content}
                onChange={(e) => setNewDocument(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter document content"
                rows={6}
                required
              />
            </div>
            <button type="submit" disabled={isLoading} className="submit-button">
              {isLoading ? 'Adding...' : 'Add Document'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}