import ngrok from 'ngrok';

export interface NgrokTunnel {
  url: string;
  close: () => Promise<void>;
}

export async function createTunnel(port: number, authToken: string): Promise<NgrokTunnel> {
  console.log(`Creating ngrok tunnel for port ${port}...`);
  
  // Kill any existing ngrok processes and wait for cleanup
  try {
    const api = ngrok.getApi();
    if (api) {
      // Try to get and disconnect all existing tunnels
      try {
        const tunnels = await api.listTunnels();
        console.log(`Found ${tunnels.tunnels?.length || 0} existing tunnels, disconnecting...`);
        for (const tunnel of tunnels.tunnels || []) {
          await ngrok.disconnect(tunnel.public_url);
        }
      } catch (e) {
        // API might not be available yet
      }
    }
    
    await ngrok.kill();
    // Wait for complete cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    // Ignore errors if no tunnels exist
    console.log('Tunnel cleanup completed');
  }
  
  const url = await ngrok.connect({
    addr: port,
    authtoken: authToken,
    onStatusChange: (status: string) => {
      console.log(`Ngrok status: ${status}`);
    },
  });

  console.log(`✓ Ngrok tunnel created: ${url}`);

  return {
    url,
    close: async () => {
      try {
        await ngrok.disconnect(url);
        await ngrok.kill();
      } catch (error) {
        console.log('Error closing tunnel:', error);
      }
    },
  };
}
