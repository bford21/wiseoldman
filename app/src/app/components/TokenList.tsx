// NOTE: Ensure your tsconfig.json has "target": "ES2020" or higher for BigInt support.
'use client';
// TODO: Run `npm install alchemy-sdk` if you haven't already.
import { useEffect, useState } from 'react';
import { Alchemy, Network, type TokenBalancesResponse, type TokenBalance } from 'alchemy-sdk';

export interface TokenListProps {
  address: string;
  apiKey: string;
  onSelectionChange?: (selected: TokenDisplay[]) => void;
}

interface TokenDisplay {
  contractAddress: string | null; // null for native ETH
  tokenBalance: string; // hex string
  symbol: string;
  name: string;
  decimals: number;
  price?: number; // USD price
  logoURI?: string;
}

async function fetchTokenPrice(symbol: string, contractAddress: string | null): Promise<number | null> {
  // Try CoinGecko API for price data
  try {
    let id = '';
    if (symbol.toLowerCase() === 'eth' && !contractAddress) {
      id = 'ethereum';
    } else if (contractAddress) {
      // Use contract address for ERC-20 tokens
      // CoinGecko uses lowercase contract addresses
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/base/contract/${contractAddress.toLowerCase()}`);
      if (res.ok) {
        const data = await res.json();
        return data?.market_data?.current_price?.usd ?? null;
      }
      return null;
    }
    if (id) {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
      if (res.ok) {
        const data = await res.json();
        return data[id]?.usd ?? null;
      }
    }
  } catch (e) {
    // Ignore errors, fallback to null
  }
  return null;
}

export default function TokenList({ address, apiKey, onSelectionChange }: TokenListProps) {
  const [tokens, setTokens] = useState<TokenDisplay[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    const alchemy = new Alchemy({
      apiKey,
      network: Network.BASE_MAINNET,
    });
    (async () => {
      try {
        // Fetch native ETH balance
        const ethBalanceRaw = await alchemy.core.getBalance(address);
        const ethBalanceHex = typeof ethBalanceRaw === 'string'
          ? ethBalanceRaw
          : ethBalanceRaw.toHexString
            ? ethBalanceRaw.toHexString()
            : ethBalanceRaw.toString();
        const ethPrice = await fetchTokenPrice('eth', null);
        const ethToken: TokenDisplay = {
          contractAddress: null,
          tokenBalance: ethBalanceHex,
          symbol: 'ETH',
          name: 'Base ETH',
          decimals: 18,
          price: ethPrice ?? undefined,
          logoURI: '/eth.png', // Place eth.png in your public folder
        };
        // Fetch ERC-20 tokens
        const response: TokenBalancesResponse = await alchemy.core.getTokenBalances(address);
        const nonZero = response.tokenBalances.filter(
          (t: TokenBalance) =>
            t.tokenBalance &&
            t.contractAddress !== null &&
            BigInt(t.tokenBalance) > BigInt(0)
        );
        const tokensWithMeta: TokenDisplay[] = await Promise.all(
          nonZero.map(async (t: TokenBalance) => {
            const meta = await alchemy.core.getTokenMetadata(t.contractAddress!);
            const price = await fetchTokenPrice(meta.symbol || '', t.contractAddress!);
            return {
              contractAddress: t.contractAddress!,
              tokenBalance: t.tokenBalance!,
              symbol: meta.symbol || '',
              name: meta.name || '',
              decimals: meta.decimals || 18,
              price: price ?? undefined,
              logoURI: meta.logo || undefined,
            };
          })
        );
        // Native ETH first, then tokens
        setTokens([ethToken, ...tokensWithMeta]);
        setSelected(new Set()); // Reset selection on new fetch
      } catch (err) {
        setError('Failed to fetch tokens');
      } finally {
        setLoading(false);
      }
    })();
  }, [address, apiKey]);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(tokens.filter(t => selected.has(t.contractAddress || 'eth')));
    }
  }, [selected, tokens, onSelectionChange]);

  const allSelected = tokens.length > 0 && selected.size === tokens.length;
  const selectedTokens = tokens.filter(t => selected.has(t.contractAddress || 'eth'));
  const selectedTotal = selectedTokens.reduce((sum, t) => sum + Number(BigInt(t.tokenBalance)) / 10 ** t.decimals, 0);
  const selectedValue = selectedTokens.reduce((sum, t) => sum + ((t.price ?? 0) * (Number(BigInt(t.tokenBalance)) / 10 ** t.decimals)), 0);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tokens.map(t => t.contractAddress || 'eth')));
    }
  };

  const toggleToken = (contractAddress: string | null) => {
    const key = contractAddress || 'eth';
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!address) return null;
  if (loading) return <div>Loading tokens...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (tokens.length === 0) return <div>No tokens found.</div>;

  return (
    <div className="w-full max-w-2xl mt-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSelectAll}
            className="px-3 py-1 rounded bg-blue-900 text-blue-100 font-bold border-2 border-blue-400 shadow hover:bg-blue-700 transition"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm text-blue-200 font-semibold">
            Selected: {selected.size} / {tokens.length}
          </span>
          <span className="text-sm text-yellow-300 font-semibold">
            Total: {selectedTotal.toLocaleString(undefined, { maximumFractionDigits: 4 })} ({selectedValue > 0 ? `$${selectedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'})
          </span>
        </div>
      </div>
      <div className="overflow-x-auto w-full rounded-lg">
        <table className="min-w-[600px] max-w-full border-collapse bg-[#23232a] rounded-lg shadow-lg overflow-hidden">
          <thead>
            <tr className="bg-blue-900 text-blue-100">
              <th className="p-2 w-8"></th>
              <th className="p-2 w-10">Logo</th>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Symbol</th>
              <th className="text-left p-2">Balance</th>
              <th className="text-left p-2">$ Value</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => {
              const key = token.contractAddress || 'eth';
              const balance = Number(BigInt(token.tokenBalance)) / 10 ** token.decimals;
              const value = token.price !== undefined ? balance * token.price : null;
              return (
                <tr key={key} className={selected.has(key) ? 'bg-blue-950/60' : ''}>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggleToken(token.contractAddress)}
                      className="accent-blue-500 w-4 h-4 rounded border-2 border-blue-400 shadow focus:ring-2 focus:ring-blue-300"
                      aria-label={`Select ${token.symbol}`}
                    />
                  </td>
                  <td className="p-2 text-center">
                    {token.logoURI ? (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-7 h-7 rounded-full border border-blue-900 bg-[#18181b] object-contain"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-900 flex items-center justify-center text-blue-200 font-bold text-sm">
                        {token.symbol ? token.symbol[0] : '?'}
                      </div>
                    )}
                  </td>
                  <td className="p-2 font-bold text-blue-200 truncate max-w-[120px] overflow-hidden">{token.name}</td>
                  <td className="p-2 text-blue-300 truncate max-w-[80px] overflow-hidden">{token.symbol}</td>
                  <td className="p-2 text-yellow-200">{balance}</td>
                  <td className="p-2 text-green-200 font-semibold">{value !== null ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        input[type='checkbox'] {
          box-shadow: 0 0 0 2px #1e3a8a;
        }
        input[type='checkbox']:checked {
          background-color: #2563eb;
        }
      `}</style>
    </div>
  );
} 