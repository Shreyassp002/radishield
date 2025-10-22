"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { CloudIcon, ShieldCheckIcon, CurrencyDollarIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  // Read contract stats
  const { data: contractStats } = useScaffoldReadContract({
    contractName: "RadiShield",
    functionName: "getContractStats",
  });

  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">🛡️ Welcome to</span>
            <span className="block text-4xl font-bold text-primary">RadiShield</span>
          </h1>
          <p className="text-center text-lg mt-4 text-base-content/70">
            Parametric Weather Insurance for African Farmers
          </p>
          
          {connectedAddress && (
            <div className="flex justify-center items-center space-x-2 flex-col mt-6">
              <p className="my-2 font-medium">Connected Address:</p>
              <Address address={connectedAddress} />
            </div>
          )}

          {!connectedAddress && (
            <div className="text-center mt-6">
              <p className="text-lg">Connect your wallet to get started with crop insurance</p>
            </div>
          )}
        </div>

        {/* Contract Stats */}
        {contractStats && (
          <div className="mt-8 px-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl">
              <div className="bg-base-100 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{contractStats[0]?.toString() || "0"}</div>
                <div className="text-sm text-base-content/70">Total Policies</div>
              </div>
              <div className="bg-base-100 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-success">{contractStats[1]?.toString() || "0"}</div>
                <div className="text-sm text-base-content/70">Active Policies</div>
              </div>
              <div className="bg-base-100 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-warning">{contractStats[2]?.toString() || "0"}</div>
                <div className="text-sm text-base-content/70">Claims Paid</div>
              </div>
            </div>
          </div>
        )}

        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-8 flex-col lg:flex-row max-w-6xl mx-auto">
            
            {/* Buy Insurance Card */}
            <div className="flex flex-col bg-base-100 px-8 py-8 text-center items-center max-w-sm rounded-3xl shadow-lg">
              <ShieldCheckIcon className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Buy Insurance</h3>
              <p className="text-base-content/70 mb-4">
                Protect your crops against drought, floods, and extreme weather with parametric insurance.
              </p>
              <Link href="/buy-insurance" className="btn btn-primary">
                Get Protected
              </Link>
            </div>

            {/* My Policies Card */}
            <div className="flex flex-col bg-base-100 px-8 py-8 text-center items-center max-w-sm rounded-3xl shadow-lg">
              <CurrencyDollarIcon className="h-12 w-12 text-success mb-4" />
              <h3 className="text-xl font-bold mb-2">My Policies</h3>
              <p className="text-base-content/70 mb-4">
                View your active insurance policies, check claim status, and manage your coverage.
              </p>
              <Link href="/my-policies" className="btn btn-success">
                View Policies
              </Link>
            </div>

            {/* Weather Monitor Card */}
            <div className="flex flex-col bg-base-100 px-8 py-8 text-center items-center max-w-sm rounded-3xl shadow-lg">
              <CloudIcon className="h-12 w-12 text-info mb-4" />
              <h3 className="text-xl font-bold mb-2">Weather Monitor</h3>
              <p className="text-base-content/70 mb-4">
                Real-time weather data and risk assessment for your farm location.
              </p>
              <Link href="/weather" className="btn btn-info">
                Check Weather
              </Link>
            </div>

          </div>

          {/* How It Works Section */}
          <div className="mt-16 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">How RadiShield Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <MapPinIcon className="h-16 w-16 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">1. Set Location</h3>
                <p className="text-base-content/70">
                  Specify your farm's GPS coordinates (Africa only) and crop type for accurate risk assessment.
                </p>
              </div>
              <div className="text-center">
                <ShieldCheckIcon className="h-16 w-16 text-success mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">2. Choose Coverage</h3>
                <p className="text-base-content/70">
                  Select coverage amount (1-10 POL) and duration. Pay a small premium to activate protection.
                </p>
              </div>
              <div className="text-center">
                <CloudIcon className="h-16 w-16 text-info mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">3. Automatic Payouts</h3>
                <p className="text-base-content/70">
                  If weather triggers are met (drought, flood, heatwave), you receive automatic payouts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
