'use client';
import Image from "next/image";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import TokenList, { type TokenDisplay } from './components/TokenList';
import { useAccount } from 'wagmi';
import { useState, useCallback } from 'react';
import { encodeFunctionData } from 'viem';

const BULK_TRANSFER_ADDRESS = '0x74E365b1178d7de36C1487Ffe0328E90EA412EC5';
const BULK_TRANSFER_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "ethAmount", "type": "uint256" },
      { "internalType": "address[]", "name": "tokens", "type": "address[]" },
      { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
    ],
    "name": "transfer",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';
  const [selectedTokens, setSelectedTokens] = useState<TokenDisplay[]>([]);
  const [txStatus, setTxStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [txHash, setTxHash] = useState<string|null>(null);
  const [txError, setTxError] = useState<string|null>(null);

  // Helper to get ETH and ERC20s from selectedTokens
  const getTransferParams = useCallback(() => {
    // For each selected token, use the raw on-chain value (BigInt) for transfer
    let ethAmount = 0n;
    const tokens: string[] = [];
    const amounts: bigint[] = [];
    selectedTokens.forEach(t => {
      if (!t.contractAddress) {
        // ETH
        ethAmount = BigInt(t.tokenBalance); // Already raw value
      } else {
        tokens.push(t.contractAddress);
        // Use the raw token balance (already in smallest unit)
        amounts.push(BigInt(t.tokenBalance));
      }
    });
    return { ethAmount, tokens, amounts };
  }, [selectedTokens]);

  // Handler for the bulk transfer button
  const handleBulkTransfer = async () => {
    setTxStatus('idle');
    setTxHash(null);
    setTxError(null);

    try {
      // 1. Ensure MetaMask is available
      const provider = (window as any).ethereum;
      if (!provider) {
        setTxError('MetaMask not found. Please install MetaMask.');
        return;
      }

      // 2. Ensure user is connected
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      if (!account) {
        setTxError('No account found. Please connect your wallet.');
        return;
      }

      // 3. Prompt for recipient
      const recipient = prompt('Enter the recipient address:');
      if (!recipient) {
        setTxError('No recipient entered.');
        return;
      }

      // 4. Prepare transfer params
      const { ethAmount, tokens, amounts } = getTransferParams();
      if (tokens.length === 0 && ethAmount === 0n) {
        setTxError('No tokens or ETH selected.');
        return;
      }

      setTxStatus('loading');

      // Debug: Print token transfer info
      for (let i = 0; i < tokens.length; i++) {
        const tokenAddress = tokens[i];
        const amount = amounts[i];
        // Find the token info from selectedTokens
        const tokenInfo = selectedTokens.find(t => t.contractAddress?.toLowerCase() === tokenAddress.toLowerCase());
        const decimals = tokenInfo?.decimals ?? 18;
        const tokenBalance = tokenInfo?.tokenBalance;
        console.log(`[DEBUG] Token: ${tokenAddress}, Amount to transfer: ${amount.toString()}, Decimals: ${decimals}, tokenBalance (raw): ${tokenBalance}`);
      }

      // 5. Encode function data
      const data = encodeFunctionData({
        abi: BULK_TRANSFER_ABI,
        functionName: 'transfer',
        args: [recipient, ethAmount, tokens, amounts],
      });

      // 6. Request EIP-7702 authorization (if supported)
      let authorizationList: any[] = [];
      let supportsSignAuthorization = false;
      try {
        // Feature-detect EIP-7702 support
        if (provider.request && typeof provider.request === 'function') {
          // Try a dummy call to see if method is supported
          await provider.request({
            method: 'wallet_getMethodAvailability',
            params: ['eth_signAuthorization'],
          });
          supportsSignAuthorization = true;
        }
      } catch {
        // Method not available, fallback to standard tx
        supportsSignAuthorization = false;
      }

      if (supportsSignAuthorization) {
        // 7. Request authorization signature
        const authorization = await provider.request({
          method: 'eth_signAuthorization',
          params: [{
            contractAddress: BULK_TRANSFER_ADDRESS,
            executor: 'self', // or another address if delegating
            // Add more fields as needed for your use case
          }],
        });
        authorizationList = [authorization];
      }

      // 8. Build transaction object
      const txParams: any = {
        from: account,
        to: BULK_TRANSFER_ADDRESS,
        data,
        value: ethAmount ? `0x${ethAmount.toString(16)}` : '0x0',
      };
      if (authorizationList.length > 0) {
        txParams.authorizationList = authorizationList;
        // Optionally, set type: '0x04' if required by the network
        // txParams.type = '0x04';
      }

      // 9. Send transaction
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      setTxStatus('success');
      setTxHash(txHash);
    } catch (err: any) {
      setTxStatus('error');
      setTxError(err?.message || String(err));
      console.error('[handleBulkTransfer] error:', err);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#18181b] font-serif relative">
      {/* Top right wallet connect */}
      <div className="absolute top-6 right-8 z-50">
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
          label="Enter the Vault"
        />
      </div>
      {/* Header */}
      <header className="flex flex-col items-center mt-10 mb-4">
        <Image src="/wom.png" alt="Wise Old Man" width={120} height={120} className="rounded-full border-4 border-blue-900 shadow-lg bg-[#23232a]" />
        <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold text-blue-200 runescape-title text-center tracking-widest blue-glow">Wise Old Man&apos;s Vault Cleaner</h1>
        <p className="mt-2 text-lg sm:text-xl text-brown-200 italic text-center max-w-xl">Bulk transfer your ERC-20 treasures on Base with the wisdom and flair of Gielinor&apos;s most legendary wizard. No fees, no nonsense—just pure vault cleaning magic.</p>
      </header>
      {/* Hero Section */}
      <section className="flex flex-col items-center bg-[#23232a] bg-opacity-95 rounded-xl shadow-xl px-8 py-6 max-w-2xl border-2 border-blue-900 mb-8">
        <h2 className="text-2xl font-bold text-blue-300 mb-2">🧙 Welcome, adventurer!</h2>
        <p className="text-brown-100 mb-4 text-center">Connect your wallet to scan your vault, select your loot, and send it on its way. The Wise Old Man will handle the heavy lifting—no bank standing required.</p>
        <div className="w-full flex flex-col items-center">
          {isConnected && address ? (
            <>
              <TokenList address={address} apiKey={alchemyApiKey} onSelectionChange={setSelectedTokens} />
              <button
                className="mt-6 px-6 py-2 rounded-lg bg-blue-700 text-white font-bold shadow-lg hover:bg-blue-800 transition disabled:opacity-50"
                disabled={selectedTokens.length === 0 || txStatus === 'loading'}
                onClick={handleBulkTransfer}
              >
                {txStatus === 'loading' ? 'Transferring...' : 'Bulk Transfer Selected Tokens'}
              </button>
              {txStatus === 'success' && txHash && (
                <div className="mt-4 text-green-300 text-sm">Success! Tx Hash: <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">{txHash}</a></div>
              )}
              {txStatus === 'error' && txError && (
                <div className="mt-4 text-red-400 text-sm">Error: {txError}</div>
              )}
            </>
          ) : (
            <div className="mt-8 text-center text-gray-300 font-semibold">Click &quot;Enter the Vault&quot; to connect your wallet and begin your adventure.</div>
          )}
        </div>
      </section>
      {/* Footer */}
      <footer className="mt-auto mb-4 text-center text-xs text-brown-400 opacity-80">
        <span>Made with 🪄 by the Wise Old Man. Not affiliated with Jagex or RuneScape.</span>
      </footer>
      <style jsx global>{`
        .runescape-title {
          font-family: 'IM Fell English SC', 'Cinzel', 'serif';
          letter-spacing: 0.08em;
        }
        .blue-glow {
          text-shadow: 0 0 8px #60a5fa, 0 0 16px #1e3a8a;
        }
        .bg-brown-700 { background-color: #7c5c2b; }
        .text-brown-200 { color: #e9d8b4; }
        .text-brown-100 { color: #f5ecd6; }
        .text-brown-400 { color: #bfa76a; }
        .border-brown-700 { border-color: #7c5c2b; }
      `}</style>
    </div>
  );
}
