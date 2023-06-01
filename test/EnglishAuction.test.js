const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("EnglishAuction", function () {
    let addr1, addr2, addr3
    let nft, englishAuction

    beforeEach(async function () {
        ;[addr1, addr2, addr3] = await ethers.getSigners()
        const NFTContract = await ethers.getContractFactory("MyToken")
        nft = await NFTContract.deploy()
        const EnglishAuctionContract = await ethers.getContractFactory(
            "EnglishAuction"
        )
        englishAuction = await EnglishAuctionContract.deploy()
        await englishAuction.deployed()
        await nft.connect(addr1).safeMint(1)
        await nft.connect(addr2).safeMint(2)
        await nft.connect(addr3).safeMint(3)
    })
    describe("Allowed actions", function () {
        it("should create an auction", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 // 1 hour

            await englishAuction.createAuction(
                nft.address,
                1,
                startingBid,
                duration
            )

            const auction = await englishAuction.auctions(0)
            expect(auction.seller).to.equal(addr1.address)
            expect(auction.nftContract).to.equal(nft.address)
            expect(auction.nftId).to.equal(1)
            expect(auction.startingBid).to.equal(startingBid)
            expect(auction.duration).to.equal(duration)
            expect(auction.started).to.be.true
            expect(auction.highestBidder).to.equal(addr1.address)
            expect(auction.highestBid).to.equal(startingBid)
        })

        it("should place a bid on an auction", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 // 1 hour

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount = ethers.utils.parseEther("2")
            await expect(() =>
                englishAuction.connect(addr2).placeBid(0, { value: bidAmount })
            ).to.changeEtherBalances([addr2], [bidAmount.mul(-1)])

            const auction = await englishAuction.auctions(0)
            expect(auction.highestBidder).to.equal(addr2.address)
            expect(auction.highestBid).to.equal(bidAmount)
        })

        it("should allow the seller to end the auction and transfer the NFT and highest bid amount", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 // 1 hour

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount = ethers.utils.parseEther("2")
            await englishAuction
                .connect(addr2)
                .placeBid(0, { value: bidAmount })

            const initialBalanceSeller = await ethers.provider.getBalance(
                addr1.address
            )
            const initialBalanceHighestBidder =
                await ethers.provider.getBalance(addr2.address)

            await englishAuction.connect(addr1).endAuction(0)

            const auction = await englishAuction.auctions(0)
            expect(auction.started).to.be.false
            expect(await nft.ownerOf(1)).to.equal(addr2.address)
        })

        it("should allow the bidder to withdraw their bid amount after the auction ends", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount = ethers.utils.parseEther("2")
            const bidAmount2 = ethers.utils.parseEther("3")
            await englishAuction
                .connect(addr2)
                .placeBid(0, { value: bidAmount })
            await englishAuction
                .connect(addr3)
                .placeBid(0, { value: bidAmount2 })

            // Wait for the auction to end
            await ethers.provider.send("evm_increaseTime", [duration + 1])

            const initialBalanceBidder = await ethers.provider.getBalance(
                addr2.address
            )

            await englishAuction.connect(addr2).withdrawAuction()
            const finalBalanceBidder = await ethers.provider.getBalance(
                addr2.address
            )

            expect(finalBalanceBidder).gt(initialBalanceBidder)
        })

        it("should transfer the NFT to the highest bidder and pay the seller after the auction ends", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount = ethers.utils.parseEther("2")
            await englishAuction
                .connect(addr2)
                .placeBid(0, { value: bidAmount })
            const initialBalanceSeller = await ethers.provider.getBalance(
                addr1.address
            )
            // Wait for the auction to end
            await ethers.provider.send("evm_increaseTime", [duration + 1])

            const initialOwner = await nft.ownerOf(1)

            await englishAuction.connect(addr1).endAuction(0)

            const finalBalanceSeller = await ethers.provider.getBalance(
                addr1.address
            )
            const afterBalanceSeller = await ethers.provider.getBalance(
                addr1.address
            )
            const finalOwner = await nft.ownerOf(1)
            expect(finalOwner).to.equal(addr2.address)
            expect(afterBalanceSeller).gt(initialBalanceSeller)
        })

        it("should allow multiple auctions to be created and bid on simultaneously", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)
            await nft.connect(addr2).approve(englishAuction.address, 2)

            const startingBid1 = ethers.utils.parseEther("1")
            const duration1 = 3600 // 1 hour
            const startingBid2 = ethers.utils.parseEther("0.5")
            const duration2 = 1800 // 30 minutes

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid1, duration1)
            await englishAuction
                .connect(addr2)
                .createAuction(nft.address, 2, startingBid2, duration2)

            const bidAmount1 = ethers.utils.parseEther("2")
            const bidAmount2 = ethers.utils.parseEther("1")

            await englishAuction
                .connect(addr2)
                .placeBid(0, { value: bidAmount1 })
            await englishAuction
                .connect(addr1)
                .placeBid(1, { value: bidAmount2 })

            const auction1 = await englishAuction.auctions(0)
            expect(auction1.highestBidder).to.equal(addr2.address)
            expect(auction1.highestBid).to.equal(bidAmount1)

            const auction2 = await englishAuction.auctions(1)
            expect(auction2.highestBidder).to.equal(addr1.address)
            expect(auction2.highestBid).to.equal(bidAmount2)
        })

        it("should require starting bid to be greater than zero", async function () {
            const startingBid = ethers.utils.parseEther("0");
            const duration = 3600; // 1 hour
          
            await expect(
              englishAuction.createAuction(nft.address, 1, startingBid, duration)
            ).to.be.revertedWith("Starting bid must be greater than zero");
          });
          
          it("should require duration to be greater than zero", async function () {
            const startingBid = ethers.utils.parseEther("1");
            const duration = 0;
          
            await expect(
              englishAuction.createAuction(nft.address, 1, startingBid, duration)
            ).to.be.revertedWith("Duration must be greater than zero");
          });
          
          it("should require a positive amount to withdraw", async function () {
            await expect(englishAuction.withdrawAuction()).to.be.revertedWith(
              "No money to withdraw"
            );
          });
          
          it("should allow only the seller to end the auction", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1);
          
            const startingBid = ethers.utils.parseEther("1");
            const duration = 3600; // 1 hour
          
            await englishAuction.createAuction(nft.address, 1, startingBid, duration);
          
            await expect(
              englishAuction.connect(addr2).endAuction(0)
            ).to.be.revertedWith("Only the seller can end the auction");
          });
          
    })

    describe("Not allowed actions", function () {
        it("should not allow the seller to place a bid", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount = ethers.utils.parseEther("2")
            await expect(
                englishAuction.connect(addr1).placeBid(0, { value: bidAmount })
            ).to.be.revertedWith("Seller cannot bid")
        })

        it("should not allow a bid lower than the current highest bid", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount1 = ethers.utils.parseEther("2")
            const bidAmount2 = ethers.utils.parseEther("1.5")

            await englishAuction
                .connect(addr2)
                .placeBid(0, { value: bidAmount1 })
            await expect(
                englishAuction.connect(addr3).placeBid(0, { value: bidAmount2 })
            ).to.be.revertedWith(
                "Bid amount must be greater than current highest bid"
            )
        })

        it("should not allow placing a bid lower than the current highest bid", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 // 1 hour

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const lowBid = ethers.utils.parseEther("0.5")
            await expect(
                englishAuction.connect(addr2).placeBid(0, { value: lowBid })
            ).to.be.revertedWith(
                "Bid amount must be greater than current highest bid"
            )

            const auction = await englishAuction.auctions(0)
            expect(auction.highestBidder).to.equal(addr1.address)
            expect(auction.highestBid).to.equal(startingBid)
        })
        it("should not allow creating an auction for an NFT not owned by the caller", async function () {

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 // 1 hour

            await expect(
                englishAuction
                    .connect(addr2)
                    .createAuction(nft.address, 1, startingBid, duration)
            ).to.be.revertedWith("Only NFT owner can create an auction")
        })

        it("should not allow placing a bid on a non-existing auction", async function () {
            const bidAmount = ethers.utils.parseEther("1")
            await expect(
                englishAuction.connect(addr1).placeBid(0, { value: bidAmount })
            ).to.be.revertedWith("Auction does not exist")
        })

        it("should not allow placing a bid after the auction has ended", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            // Wait for the auction to end
            await ethers.provider.send("evm_increaseTime", [duration + 1])

            const bidAmount = ethers.utils.parseEther("2")
            await expect(
                englishAuction.connect(addr2).placeBid(0, { value: bidAmount })
            ).to.be.revertedWith("ended")
        })
    })

    describe("Events", function () {

        it("should emit AuctionCreated event when creating an auction", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 

            await expect(
                englishAuction
                    .connect(addr1)
                    .createAuction(nft.address, 1, startingBid, duration)
            )
                .to.emit(englishAuction, "AuctionCreated")
                .withArgs(
                    0,
                    addr1.address,
                    nft.address,
                    1,
                    startingBid,
                    duration
                )
        })

        it("should emit BidPlaced event when placing a bid", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount = ethers.utils.parseEther("2")
            await expect(
                englishAuction.connect(addr2).placeBid(0, { value: bidAmount })
            )
                .to.emit(englishAuction, "BidPlaced")
                .withArgs(0, addr2.address, bidAmount)
        })

        it("should emit AuctionEnded event when the auction ends", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount = ethers.utils.parseEther("2")
            await englishAuction
                .connect(addr2)
                .placeBid(0, { value: bidAmount })

            // Wait for the auction to end
            await ethers.provider.send("evm_increaseTime", [duration])
            await ethers.provider.send("evm_mine")

            await expect(englishAuction.connect(addr1).endAuction(0))
                .to.emit(englishAuction, "AuctionEnded")
                .withArgs(0, addr2.address, bidAmount)
        })

        it("should emit BidderWithdrawn event when bidder withdraws their bid", async function () {
            await nft.connect(addr1).approve(englishAuction.address, 1)

            const startingBid = ethers.utils.parseEther("1")
            const duration = 3600 

            await englishAuction
                .connect(addr1)
                .createAuction(nft.address, 1, startingBid, duration)

            const bidAmount = ethers.utils.parseEther("2")
            await englishAuction
                .connect(addr2)
                .placeBid(0, { value: bidAmount })

                const bidAmount2= ethers.utils.parseEther("3")
            await englishAuction
                .connect(addr3)
                .placeBid(0, { value: bidAmount2 })
            await ethers.provider.send("evm_increaseTime", [duration])
            await ethers.provider.send("evm_mine")

            await expect(englishAuction.connect(addr2).withdrawAuction())
                .to.emit(englishAuction, "BidderWithdrawn")
                .withArgs(addr2.address, bidAmount)
        })
    })
})
