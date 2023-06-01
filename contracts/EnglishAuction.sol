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

contract EnglishAuction {
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

    event AuctionCreated(
        uint256 auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 nftId,
        uint256 startingBid,
        uint256 duration
    );
    event BidPlaced(uint256 auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(
        uint256 auctionId,
        address indexed winner,
        uint256 amount
    );
    event BidderWithdrawn(address indexed bidder, uint256 amount);

    uint256 public auctionCount;
    mapping(address => uint256) public bidderMoneyToWithdraw;
    Auction[] public auctions;

    modifier auctionExists(uint _auctionId) {
        require(_auctionId < auctions.length, "auction does not exist");
        _;
    }

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

    function withdrawAuction() external {
        uint256 amount = bidderMoneyToWithdraw[msg.sender];
        require(amount > 0, "No money to withdraw");

        bidderMoneyToWithdraw[msg.sender] = 0;
        payable(msg.sender).transfer(amount);

        emit BidderWithdrawn(msg.sender, amount);
    }

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
