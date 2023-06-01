// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IERC721 {
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function ownerOf(uint256 _tokenId) external view returns (address);
}


 /// @title EnglishAuction
 /// @dev This contract implements an English auction for non-fungible tokens (NFTs).
 
contract EnglishAuction {
    
     /// @dev Struct representing an auction.
     /// @param seller The address of the auction seller.
     /// @param nftContract The address of the NFT contract.
     /// @param nftId The ID of the NFT being auctioned.
     /// @param startingBid The starting bid for the auction.
     /// @param duration The duration of the auction, in seconds.
     /// @param endAt The timestamp when the auction ends.
     /// @param started Flag indicating if the auction has started.
     /// @param highestBidder The address of the highest bidder.
     /// @param highestBid The highest bid amount.
     
    struct Auction {
        address seller;
        address nftContract;
        uint256 nftId;
        uint256 startingBid;
        uint256 duration;
        uint256 endAt;
        bool started;
        address highestBidder;
        uint256 highestBid;
    }

    
     /// @dev Emitted when a new auction is created.
     /// @param auctionId The ID of the auction.
     /// @param seller The address of the auction seller.
     /// @param nftContract The address of the NFT contract.
     /// @param nftId The ID of the NFT being auctioned.
     /// @param startingBid The starting bid for the auction.
     /// @param duration The duration of the auction, in seconds.
     
    event AuctionCreated(
        uint256 auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 nftId,
        uint256 startingBid,
        uint256 duration
    );

    
     /// @dev Emitted when a bid is placed on an auction.
     /// @param auctionId The ID of the auction.
     /// @param bidder The address of the bidder.
     /// @param amount The bid amount.
     
    event BidPlaced(uint256 auctionId, address indexed bidder, uint256 amount);

    
     /// @dev Emitted when an auction ends.
     /// @param auctionId The ID of the auction.
     /// @param winner The address of the auction winner.
     /// @param amount The winning bid amount.
     
    event AuctionEnded(
        uint256 auctionId,
        address indexed winner,
        uint256 amount
    );

    
     /// @dev Emitted when a bidder withdraws their funds.
     /// @param bidder The address of the bidder.
     /// @param amount The amount withdrawn.
     
    event BidderWithdrawn(address indexed bidder, uint256 amount);

    
     /// @dev The total number of auctions created.
     
    uint256 public auctionCount;

    
     /// @dev Mapping of bidder addresses to the amount of money they can withdraw.
     
    mapping(address => uint256) public bidderMoneyToWithdraw;

    
     /// @dev Array storing all the auctions.
     
    Auction[] public auctions;

    
     /// @dev Modifier to check if an auction exists.
     /// @param _auctionId The ID of the auction.
     
    modifier auctionExists(uint256 _auctionId) {
        require(_auctionId < auctions.length, "Auction does not exist");
        _;
    }

    
     /// @dev Creates a new auction.
     /// @param _nftContract The address of the NFT contract.
     /// @param _nftId The ID of the NFT being auctioned.
     /// @param _startingBid The starting bid for the auction.
     /// @param _duration The duration of the auction, in seconds.
     
    function createAuction(
        address _nftContract,
        uint256 _nftId,
        uint256 _startingBid,
        uint256 _duration
    ) external {
        require(
            IERC721(_nftContract).ownerOf(_nftId) == msg.sender,
            "Only NFT owner can create an auction"
        );

        require(_startingBid > 0, "Starting bid must be greater than zero");
        require(_duration > 0, "Duration must be greater than zero");

        auctions.push(
            Auction({
                seller: msg.sender,
                nftContract: _nftContract,
                nftId: _nftId,
                startingBid: _startingBid,
                duration: _duration,
                started: true,
                endAt: block.timestamp + _duration,
                highestBid: _startingBid,
                highestBidder: msg.sender
            })
        );
        emit AuctionCreated(
            auctionCount,
            msg.sender,
            _nftContract,
            _nftId,
            _startingBid,
            _duration
        );

        auctionCount++;
    }

    
     /// @dev Places a bid on an auction.
     /// @param _auctionId The ID of the auction.
     
    function placeBid(
        uint256 _auctionId
    ) external payable auctionExists(_auctionId) {
        if (block.timestamp > auctions[_auctionId].endAt) {
            auctions[_auctionId].started = false;
            revert("Auction ended");
        }
        Auction storage auction = auctions[_auctionId];
        require(
            msg.value > auction.highestBid,
            "Bid amount must be greater than current highest bid"
        );
        require(msg.sender != auction.seller, "Seller cannot bid");

        bidderMoneyToWithdraw[auction.highestBidder] = auction.highestBid;
        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit BidPlaced(_auctionId, msg.sender, msg.value);
    }

    
     /// @dev Allows a bidder to withdraw their funds.
     
    function withdrawAuction() external {
        uint256 amount = bidderMoneyToWithdraw[msg.sender];
        require(amount > 0, "No money to withdraw");

        bidderMoneyToWithdraw[msg.sender] = 0;
        payable(msg.sender).transfer(amount);

        emit BidderWithdrawn(msg.sender, amount);
    }

    
     /// @dev Ends an auction and transfers the NFT to the highest bidder.
     /// @param _auctionId The ID of the auction.
     
    function endAuction(uint256 _auctionId) external auctionExists(_auctionId) {
        if (block.timestamp > auctions[_auctionId].endAt) {
            auctions[_auctionId].started = false;
        }
        Auction storage auction = auctions[_auctionId];
        require(
            auction.seller == msg.sender,
            "Only the seller can end the auction"
        );

        auction.started = false;
        IERC721 nft = IERC721(auction.nftContract);

        nft.safeTransferFrom(msg.sender, auction.highestBidder, auction.nftId);
        payable(auction.seller).transfer(auction.highestBid);

        emit AuctionEnded(
            _auctionId,
            auction.highestBidder,
            auction.highestBid
        );
    }
}
