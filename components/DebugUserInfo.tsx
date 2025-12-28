import React from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Componente de debugging para mostrar información del usuario
 * SOLO PARA DESARROLLO - Eliminar en producción
 */
const DebugUserInfo: React.FC = () => {
    const { user, profile, businesses } = useAuth();

    // Solo mostrar en desarrollo
    if (import.meta.env.PROD) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(0, 0, 0, 0.9)',
            color: '#00ff00',
            padding: '15px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            maxWidth: '400px',
            maxHeight: '500px',
            overflow: 'auto',
            zIndex: 9999,
            border: '2px solid #00ff00',
        }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#00ff00' }}>🐛 Debug Info</h3>

            <div style={{ marginBottom: '10px' }}>
                <strong>User ID:</strong>
                <div style={{ color: '#ffff00' }}>{user?.id || 'No user'}</div>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <strong>User Email:</strong>
                <div style={{ color: '#ffff00' }}>{user?.email || 'No email'}</div>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <strong>Profile Role:</strong>
                <div style={{ color: '#ffff00' }}>{profile?.role || 'No role'}</div>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <strong>Profile Plan:</strong>
                <div style={{ color: '#ffff00' }}>{profile?.plan || 'No plan'}</div>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <strong>Businesses Count:</strong>
                <div style={{ color: '#ffff00' }}>{businesses?.length || 0}</div>
            </div>

            {businesses && businesses.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                    <strong>Businesses:</strong>
                    {businesses.map((business, index) => (
                        <div key={business.id} style={{
                            marginLeft: '10px',
                            marginTop: '5px',
                            padding: '5px',
                            background: 'rgba(0, 255, 0, 0.1)',
                            borderRadius: '4px'
                        }}>
                            <div style={{ color: '#00ffff' }}>#{index + 1}: {business.name}</div>
                            <div style={{ fontSize: '10px', color: '#888' }}>
                                ID: {business.id}
                            </div>
                            <div style={{ fontSize: '10px', color: '#888' }}>
                                Owner: {business.owner_id}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid #00ff00',
                fontSize: '10px',
                color: '#888'
            }}>
                Actualizado: {new Date().toLocaleTimeString()}
            </div>
        </div>
    );
};

export default DebugUserInfo;
