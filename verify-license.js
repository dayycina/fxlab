const fs = require('fs');
const path = require('path');

// In-memory activation storage (will reset on deployment but works for demo)
// For production, use Vercel KV Store, MongoDB, or similar
let activations = {};

/**
 * A simple license validation API endpoint
 * 
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Check if this is an activation request or just a validation
    const isActivation = req.query.activate === 'true';
    const deviceId = req.query.deviceId || 'unknown';
    
    // Get license key from query
    const { key } = req.query;
    
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ valid: false, message: 'Invalid license key format' });
    }
    
    // Remove dashes from the key
    const cleanKey = key.replace(/-/g, '');
    
    // Check if the cleaned key is valid (16 characters)
    if (cleanKey.length !== 16) {
      return res.status(400).json({ valid: false, message: 'Invalid license key length (should be 16 characters without dashes)' });
    }
    
    // Path to the main keys file
    const keysFile = path.join(process.cwd(), 'fxlab_valid_keys.txt');
    
    // Check if file exists
    if (!fs.existsSync(keysFile)) {
      console.error('License keys file not found');
      return res.status(500).json({ valid: false, message: 'License validation system error' });
    }
    
    // Read the file and check for the key
    const fileContent = fs.readFileSync(keysFile, 'utf8');
    
    // Process all keys in the file - remove dashes from them too
    const validKeys = fileContent
      .split('\n')
      .map(k => k.trim().replace(/-/g, ''))
      .filter(k => k.length === 16);
    
    // Check if key is valid
    const isValidKey = validKeys.includes(cleanKey);
    
    // If key isn't valid, return immediately
    if (!isValidKey) {
      return res.status(200).json({ valid: false, message: 'Invalid license key' });
    }
    
    // Key is valid, now check activations
    // Check if key is already activated on a different device
    if (activations[cleanKey]) {
      // If this is the same device, allow it
      if (activations[cleanKey] === deviceId) {
        return res.status(200).json({ valid: true, message: 'License key is valid' });
      }
      
      // If different device and this is a validation request, reject
      if (!isActivation) {
        return res.status(200).json({ 
          valid: false, 
          message: 'License key is already activated on another device' 
        });
      }
      
      // If this is an activation request, update the device ID
      if (isActivation) {
        activations[cleanKey] = deviceId;
        return res.status(200).json({ 
          valid: true, 
          message: 'License key has been transferred to this device' 
        });
      }
    } else if (isActivation) {
      // First activation for this key
      activations[cleanKey] = deviceId;
    }
    
    return res.status(200).json({ valid: true, message: 'License key is valid' });
    
  } catch (error) {
    console.error('License verification error:', error);
    return res.status(500).json({ valid: false, message: 'Server error during license validation', error: error.toString() });
  }
} 
