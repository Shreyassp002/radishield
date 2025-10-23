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
      {/* Hero Section */}
      <div className="py-20">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="bg-primary/10 p-4 rounded-2xl">
                <ShieldCheckIcon className="h-16 w-16 text-primary" />
              </div>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              RadiShield
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Weather insurance for African farmers, powered by blockchain technology
            </p>
            
            {connectedAddress ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 inline-block border border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-2">Connected Wallet</p>
                <Address address={connectedAddress} />
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 inline-block border border-gray-200">
                <p className="text-lg text-gray-700 mb-4">Connect your wallet to get started</p>
                <p className="text-sm text-gray-500">Secure crop insurance</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contract Stats */}
      {contractStats && (
        <div className="py-16">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Platform Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="stat-card">
                <div className="text-4xl font-bold text-primary mb-2">{contractStats[0]?.toString() || "0"}</div>
                <div className="text-gray-600 font-medium">Total Policies</div>
              </div>
              <div className="stat-card">
                <div className="text-4xl font-bold text-primary mb-2">{contractStats[1]?.toString() || "0"}</div>
                <div className="text-gray-600 font-medium">Active Policies</div>
              </div>
              <div className="stat-card">
                <div className="text-4xl font-bold text-primary mb-2">{contractStats[2]?.toString() || "0"}</div>
                <div className="text-gray-600 font-medium">Claims Paid</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Section */}
      <div className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Services</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Simple insurance solutions for African farmers
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Buy Insurance Card */}
            <div className="card p-8 text-center h-full flex flex-col">
              <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-6">
                <ShieldCheckIcon className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Buy Insurance</h3>
              <p className="text-gray-600 mb-8 flex-grow">
                Protect your crops against extreme weather
              </p>
              <Link href="/buy-insurance" className="btn btn-primary w-full">
                Get Protected
              </Link>
            </div>

            {/* My Policies Card */}
            <div className="card p-8 text-center h-full flex flex-col">
              <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-6">
                <CurrencyDollarIcon className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">My Policies</h3>
              <p className="text-gray-600 mb-8 flex-grow">
                View your active policies and claims
              </p>
              <Link href="/my-policies" className="btn btn-primary w-full">
                View Policies
              </Link>
            </div>

            {/* Weather Monitor Card */}
            <div className="card p-8 text-center h-full flex flex-col">
              <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-6">
                <CloudIcon className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Weather Monitor</h3>
              <p className="text-gray-600 mb-8 flex-grow">
                Real-time weather data for your farm
              </p>
              <Link href="/weather" className="btn btn-primary w-full">
                Check Weather
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Simple, automated insurance process
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-primary/10 p-6 rounded-2xl w-fit mx-auto mb-6">
                <MapPinIcon className="h-16 w-16 text-primary" />
              </div>
              <div className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-full w-fit mx-auto mb-4">
                STEP 1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Set Location</h3>
              <p className="text-gray-600">
                Enter your farm coordinates and crop type
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-primary/10 p-6 rounded-2xl w-fit mx-auto mb-6">
                <ShieldCheckIcon className="h-16 w-16 text-primary" />
              </div>
              <div className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-full w-fit mx-auto mb-4">
                STEP 2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Choose Coverage</h3>
              <p className="text-gray-600">
                Select amount and duration, pay premium
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-primary/10 p-6 rounded-2xl w-fit mx-auto mb-6">
                <CloudIcon className="h-16 w-16 text-primary" />
              </div>
              <div className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-full w-fit mx-auto mb-4">
                STEP 3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Get Payouts</h3>
              <p className="text-gray-600">
                Automatic payouts when weather triggers hit
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
