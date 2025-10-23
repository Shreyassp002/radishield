import { useRef, useState } from "react";
import { NetworkOptions } from "./NetworkOptions";
import { getAddress } from "viem";
import { Address } from "viem";
import { useAccount, useDisconnect } from "wagmi";
import {
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import { BlockieAvatar, isENS } from "~~/components/scaffold-eth";
import { useCopyToClipboard, useOutsideClick } from "~~/hooks/scaffold-eth";
import { getTargetNetworks } from "~~/utils/scaffold-eth";

const allowedNetworks = getTargetNetworks();

type AddressInfoDropdownProps = {
  address: Address;
  blockExplorerAddressLink: string | undefined;
  displayName: string;
  ensAvatar?: string;
};

export const AddressInfoDropdown = ({
  address,
  ensAvatar,
  displayName,
  blockExplorerAddressLink,
}: AddressInfoDropdownProps) => {
  const { disconnect } = useDisconnect();
  const checkSumAddress = getAddress(address);

  const { copyToClipboard: copyAddressToClipboard, isCopiedToClipboard: isAddressCopiedToClipboard } =
    useCopyToClipboard();
  const [selectingNetwork, setSelectingNetwork] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = () => {
    setSelectingNetwork(false);
    setIsOpen(false);
  };

  useOutsideClick(dropdownRef, closeDropdown);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    copyAddressToClipboard(checkSumAddress);
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    disconnect();
    closeDropdown();
  };

  const handleSwitchNetwork = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectingNetwork(true);
  };

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Dropdown Button */}
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      >
        <BlockieAvatar address={checkSumAddress} size={24} ensImage={ensAvatar} />
        <span className="text-sm font-medium text-gray-700">
          {isENS(displayName) ? displayName : checkSumAddress?.slice(0, 6) + "..." + checkSumAddress?.slice(-4)}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {!selectingNetwork && (
              <>
                {/* Copy Address */}
                <button
                  onClick={handleCopyAddress}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {isAddressCopiedToClipboard ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <DocumentDuplicateIcon className="h-4 w-4" />
                      <span>Copy address</span>
                    </>
                  )}
                </button>

                {/* View QR Code */}
                <label
                  htmlFor="qrcode-modal"
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <QrCodeIcon className="h-4 w-4" />
                  <span>View QR Code</span>
                </label>

                {/* View on Block Explorer */}
                {blockExplorerAddressLink && (
                  <a
                    href={blockExplorerAddressLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    <span>View on Block Explorer</span>
                  </a>
                )}

                {/* Switch Network */}
                {allowedNetworks.length > 1 && (
                  <button
                    onClick={handleSwitchNetwork}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ArrowsRightLeftIcon className="h-4 w-4" />
                    <span>Switch Network</span>
                  </button>
                )}

                {/* Divider */}
                <div className="border-t border-gray-100 my-1"></div>

                {/* Disconnect */}
                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                  <span>Disconnect</span>
                </button>
              </>
            )}

            {/* Network Options */}
            {selectingNetwork && (
              <div className="px-2">
                <button
                  onClick={() => setSelectingNetwork(false)}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded mb-2"
                >
                  ← Back
                </button>
                <NetworkOptions hidden={false} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
