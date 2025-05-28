'use client';
import Image from "next/image";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import TokenList from './components/TokenList';
import { useAccount } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';

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
            <TokenList address={address} apiKey={alchemyApiKey} />
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
