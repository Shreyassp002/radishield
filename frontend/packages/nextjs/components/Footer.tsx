import React from "react";
import Link from "next/link";
import { hardhat } from "viem/chains";
import { CurrencyDollarIcon, MagnifyingGlassIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useGlobalState } from "~~/services/store/store";

/**
 * Professional site footer for RadiShield
 */
export const Footer = () => {
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <>
      {/* Development Tools - Fixed Bottom */}
      {isLocalNetwork && (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-auto">
          <Faucet />
          <Link href="/blockexplorer" className="btn btn-primary btn-sm">
            <MagnifyingGlassIcon className="h-4 w-4" />
            Block Explorer
          </Link>
        </div>
      )}

      {/* Main Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-gray-200 mt-auto">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                <ShieldCheckIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">RadiShield</h3>
                <p className="text-xs text-gray-600">Weather Insurance</p>
              </div>
            </div>

            {/* Network Info */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Network: <span className="text-primary font-medium">{targetNetwork.name}</span></span>
              {nativeCurrencyPrice > 0 && (
                <div className="flex items-center gap-1">
                  <CurrencyDollarIcon className="h-4 w-4" />
                  <span>${nativeCurrencyPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
