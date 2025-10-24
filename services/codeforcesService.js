const axios = require('axios');
const cheerio = require('cheerio');

class CodeforcesService {
  constructor() {
    this.baseURL = 'https://codeforces.com/api';
    this.webURL = 'https://codeforces.com';
    this.universityId = '13125'; // BAIUST University ID
    
    // Rate limiting: Codeforces allows 5 requests per second
    this.rateLimitDelay = 300; // 300ms between requests to respect limits but keep it fast
    this.lastRequestTime = 0;
  }

  // Rate limiting helper
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  // Generic API request with error handling and rate limiting
  async makeRequest(endpoint, params = {}) {
    await this.waitForRateLimit();
    
    try {
      const url = `${this.baseURL}/${endpoint}`;
      console.log(`Making request to: ${url}`, params);
      
      const response = await axios.get(url, { 
        params,
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.status === 'OK') {
        return response.data.result;
      } else {
        throw new Error(`Codeforces API error: ${response.data.comment || 'Unknown error'}`);
      }
    } catch (error) {
      if (error.response) {
        console.error(`API Error ${error.response.status}:`, error.response.data);
        throw new Error(`Codeforces API error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        console.error('Network Error:', error.message);
        throw new Error('Network error: Unable to reach Codeforces API');
      } else {
        console.error('Error:', error.message);
        throw error;
      }
    }
  }

  // Get university members using Codeforces API
  async getUniversityMembers() {
    console.log('Fetching university members using Codeforces API...');
    
    try {
      // Method 1: Get all rated users and filter by organization
      console.log('Fetching rated users and filtering by organization...');
      const ratedUsers = await this.makeRequest('user.ratedList', {
        activeOnly: false,
        includeRetired: true
      });

      // Filter users by organization
      const baiustMembers = ratedUsers.filter(user => 
        user.organization && 
        (user.organization.toLowerCase().includes('baiust') || 
         user.organization.toLowerCase().includes('bangladesh army international university') ||
         user.organization.toLowerCase().includes('bangladesh army international') ||
         user.organization === 'Bangladesh Army International University of Science and Technology')
      );

      if (baiustMembers.length > 0) {
        console.log(`Found ${baiustMembers.length} BAIUST members from rated list`);
        console.log(`Fetching individual problem counts for members...`);
        
        // Get individual problem counts for each member
        const membersWithProblems = [];
        const batchSize = 3; // Process 3 users at a time to avoid rate limits
        
        for (let i = 0; i < baiustMembers.length; i += batchSize) {
          const batch = baiustMembers.slice(i, i + batchSize);
          
          console.log(`Processing problems batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(baiustMembers.length / batchSize)} (members ${i + 1}-${Math.min(i + batchSize, baiustMembers.length)})`);
          
          const batchPromises = batch.map(async (user, index) => {
            try {
              // Small delay within batch
              if (index > 0) {
                await new Promise(resolve => setTimeout(resolve, index * 200));
              }
              
              // Get submissions to count solved problems
              const submissions = await this.getUserSubmissions(user.handle, 3000); // Limit to 3000 for performance
              
              // Count unique solved problems
              const solvedProblems = new Set();
              submissions.forEach(submission => {
                if (submission.verdict === 'OK') {
                  const problemKey = `${submission.problem.contestId}-${submission.problem.index}`;
                  solvedProblems.add(problemKey);
                }
              });
              
              return {
                handle: user.handle,
                displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.handle,
                rating: user.rating || 0,
                maxRating: user.maxRating || 0,
                organization: user.organization || '',
                problemsSolved: solvedProblems.size,
                totalSubmissions: submissions.length
              };
            } catch (error) {
              console.error(`Error fetching problems for ${user.handle}:`, error.message);
              return {
                handle: user.handle,
                displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.handle,
                rating: user.rating || 0,
                maxRating: user.maxRating || 0,
                organization: user.organization || '',
                problemsSolved: 0,
                totalSubmissions: 0
              };
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          membersWithProblems.push(...batchResults);
          
          // Delay between batches
          if (i + batchSize < baiustMembers.length) {
            console.log('Waiting between batches...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        return membersWithProblems;
      }

      // If no members found by organization, return empty array
      console.log('No members found by organization filter');
      return [];
      
    } catch (error) {
      console.error('Error fetching university members from API:', error.message);
      throw error; // Don't use fallback, only real API data
    }
  }

  // Get user information
  async getUserInfo(handle) {
    try {
      const result = await this.makeRequest('user.info', { handles: handle });
      return result[0]; // API returns array, we need first element
    } catch (error) {
      console.error(`Error fetching user info for ${handle}:`, error.message);
      throw error;
    }
  }

  // Get user rating history
  async getUserRating(handle) {
    try {
      return await this.makeRequest('user.rating', { handle });
    } catch (error) {
      console.error(`Error fetching rating for ${handle}:`, error.message);
      return []; // Return empty array if no rating history
    }
  }

  // Get user submissions
  async getUserSubmissions(handle, count = 10000) {
    try {
      return await this.makeRequest('user.status', { 
        handle, 
        from: 1, 
        count: Math.min(count, 10000) // API limit is 10000
      });
    } catch (error) {
      console.error(`Error fetching submissions for ${handle}:`, error.message);
      return []; // Return empty array if no submissions
    }
  }

  // Get contest information
  async getContestInfo(contestId) {
    try {
      const contests = await this.makeRequest('contest.list');
      return contests.find(contest => contest.id === contestId);
    } catch (error) {
      console.error(`Error fetching contest ${contestId}:`, error.message);
      return null;
    }
  }

  // Calculate user statistics
  async getUserStats(handle) {
    try {
      console.log(`Calculating stats for user: ${handle}`);
      
      // Get user info and rating history in parallel
      const [userInfo, ratingHistory] = await Promise.all([
        this.getUserInfo(handle),
        this.getUserRating(handle)
      ]);

      // Get user submissions
      const submissions = await this.getUserSubmissions(handle);

      // Calculate statistics
      const stats = this.calculateUserStatistics(userInfo, ratingHistory, submissions);
      
      return {
        handle: handle,
        displayName: userInfo.firstName && userInfo.lastName 
          ? `${userInfo.firstName} ${userInfo.lastName}` 
          : handle,
        ...stats
      };
    } catch (error) {
      console.error(`Error calculating stats for ${handle}:`, error.message);
      return {
        handle: handle,
        displayName: handle,
        rating: 0,
        maxRating: 0,
        contestsParticipated: 0,
        problemsSolved: 0,
        totalPoints: 0,
        error: error.message
      };
    }
  }

  // Calculate statistics from user data
  calculateUserStatistics(userInfo, ratingHistory, submissions) {
    // Basic rating information
    const rating = userInfo.rating || 0;
    const maxRating = userInfo.maxRating || 0;
    
    // Contest participation count
    const contestsParticipated = ratingHistory.length;
    
    // Calculate solved problems (unique problems with OK verdict)
    const solvedProblems = new Set();
    let totalPoints = 0;
    
    submissions.forEach(submission => {
      if (submission.verdict === 'OK') {
        const problemKey = `${submission.problem.contestId}-${submission.problem.index}`;
        solvedProblems.add(problemKey);
        
        // Add points if available
        if (submission.problem.points) {
          totalPoints += submission.problem.points;
        }
      }
    });
    
    const problemsSolved = solvedProblems.size;
    
    // Calculate additional metrics
    const totalSubmissions = submissions.length;
    const successfulSubmissions = submissions.filter(s => s.verdict === 'OK').length;
    const successRate = totalSubmissions > 0 ? 
      Math.round((successfulSubmissions / totalSubmissions) * 100) : 0;

    return {
      rating,
      maxRating,
      contestsParticipated,
      problemsSolved,
      totalPoints: Math.round(totalPoints),
      totalSubmissions,
      successfulSubmissions,
      successRate,
      rank: userInfo.rank || 'unrated',
      maxRank: userInfo.maxRank || 'unrated',
      country: userInfo.country || '',
      city: userInfo.city || '',
      organization: userInfo.organization || '',
      lastOnline: userInfo.lastOnlineTimeSeconds ? 
        new Date(userInfo.lastOnlineTimeSeconds * 1000).toISOString() : null,
      registrationTime: userInfo.registrationTimeSeconds ? 
        new Date(userInfo.registrationTimeSeconds * 1000).toISOString() : null
    };
  }

  // Get all contests participated by university members
  async getUniversityContests() {
    try {
      console.log('Fetching university contest participation data...');
      
      // Get all university members
      const members = await this.getUniversityMembers();
      
      if (members.length === 0) {
        throw new Error('No university members found');
      }
      
      console.log(`Fetching contest history and problem stats for ${members.length} members...`);
      
      const allContests = new Map(); // contestId -> contest details with participants
      const userParticipations = [];
      let totalProblemsAcrossAllMembers = 0;
      
      // Process members in smaller batches to avoid rate limits
      const batchSize = 3;
      for (let i = 0; i < members.length; i += batchSize) {
        const batch = members.slice(i, i + batchSize);
        
        console.log(`Processing contest history batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(members.length / batchSize)}`);
        
        const batchPromises = batch.map(async (member, index) => {
          try {
            // Small delay within batch
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, index * 200));
            }
            
            // Get both contest history and submission data
            const [ratingHistory, submissions] = await Promise.all([
              this.getUserRating(member.handle),
              this.getUserSubmissions(member.handle, 5000) // Limit to 5000 submissions for performance
            ]);
            
            // Count solved problems
            const solvedProblems = new Set();
            submissions.forEach(submission => {
              if (submission.verdict === 'OK') {
                const problemKey = `${submission.problem.contestId}-${submission.problem.index}`;
                solvedProblems.add(problemKey);
              }
            });
            
            const problemsSolved = solvedProblems.size;
            totalProblemsAcrossAllMembers += problemsSolved;
            
            ratingHistory.forEach(contest => {
              const contestKey = contest.contestId;
              
              // Add to all contests map
              if (!allContests.has(contestKey)) {
                allContests.set(contestKey, {
                  contestId: contest.contestId,
                  contestName: contest.contestName,
                  participants: [],
                  totalParticipants: 0,
                  averageRank: 0,
                  averageRatingChange: 0,
                  firstParticipation: contest.ratingUpdateTimeSeconds,
                  lastParticipation: contest.ratingUpdateTimeSeconds
                });
              }
              
              const contestData = allContests.get(contestKey);
              contestData.participants.push({
                handle: member.handle,
                displayName: member.displayName || member.handle,
                rank: contest.rank,
                oldRating: contest.oldRating,
                newRating: contest.newRating,
                ratingChange: contest.newRating - contest.oldRating,
                date: new Date(contest.ratingUpdateTimeSeconds * 1000).toISOString(),
                problemsSolved: problemsSolved // Add individual problems solved count
              });
              
              // Update contest statistics
              contestData.totalParticipants = contestData.participants.length;
              contestData.firstParticipation = Math.min(contestData.firstParticipation, contest.ratingUpdateTimeSeconds);
              contestData.lastParticipation = Math.max(contestData.lastParticipation, contest.ratingUpdateTimeSeconds);
            });
            
            return {
              handle: member.handle,
              displayName: member.displayName || member.handle,
              contestsParticipated: ratingHistory.length,
              problemsSolved: problemsSolved,
              contests: ratingHistory
            };
          } catch (error) {
            console.error(`Error fetching data for ${member.handle}:`, error.message);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        userParticipations.push(...batchResults.filter(result => result !== null));
        
        // Delay between batches
        if (i + batchSize < members.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Calculate final statistics for each contest
      const contests = Array.from(allContests.values()).map(contest => {
        const totalRank = contest.participants.reduce((sum, p) => sum + p.rank, 0);
        const totalRatingChange = contest.participants.reduce((sum, p) => sum + p.ratingChange, 0);
        
        return {
          ...contest,
          averageRank: Math.round(totalRank / contest.totalParticipants),
          averageRatingChange: Math.round(totalRatingChange / contest.totalParticipants),
          firstParticipation: new Date(contest.firstParticipation * 1000).toISOString(),
          lastParticipation: new Date(contest.lastParticipation * 1000).toISOString()
        };
      });
      
      // Sort contests by participation count and then by date
      contests.sort((a, b) => {
        if (b.totalParticipants !== a.totalParticipants) {
          return b.totalParticipants - a.totalParticipants;
        }
        return new Date(b.lastParticipation) - new Date(a.lastParticipation);
      });
      
      return {
        university: 'Bangladesh Army International University of Science and Technology (BAIUST)',
        universityId: this.universityId,
        totalMembers: members.length,
        totalContests: contests.length,
        totalParticipations: userParticipations.reduce((sum, user) => sum + user.contestsParticipated, 0),
        totalProblemsSolved: totalProblemsAcrossAllMembers,
        averageProblemsPerMember: Math.round(totalProblemsAcrossAllMembers / members.length),
        lastUpdated: new Date().toISOString(),
        contests: contests,
        memberParticipations: userParticipations,
        problemSolvingStats: {
          totalProblems: totalProblemsAcrossAllMembers,
          averagePerMember: Math.round(totalProblemsAcrossAllMembers / members.length),
          topProblemSolver: userParticipations.length > 0 ? 
            userParticipations.reduce((top, user) => 
              user.problemsSolved > (top.problemsSolved || 0) ? user : top, userParticipations[0]) : null,
          problemSolvingDistribution: {
            beginner: userParticipations.filter(u => u.problemsSolved <= 50).length,
            intermediate: userParticipations.filter(u => u.problemsSolved > 50 && u.problemsSolved <= 200).length,
            advanced: userParticipations.filter(u => u.problemsSolved > 200 && u.problemsSolved <= 500).length,
            expert: userParticipations.filter(u => u.problemsSolved > 500).length
          }
        }
      };
    } catch (error) {
      console.error('Error getting university contests:', error.message);
      throw error;
    }
  }

  // Get popular contests among university members
  async getPopularContests() {
    try {
      const allContests = await this.getUniversityContests();
      
      // Get top contests by participation
      const popularContests = allContests.contests
        .filter(contest => contest.totalParticipants >= 2) // At least 2 participants
        .slice(0, 50) // Top 50 contests
        .map(contest => ({
          contestId: contest.contestId,
          contestName: contest.contestName,
          totalParticipants: contest.totalParticipants,
          averageRank: contest.averageRank,
          averageRatingChange: contest.averageRatingChange,
          lastParticipation: contest.lastParticipation,
          participationRate: Math.round((contest.totalParticipants / allContests.totalMembers) * 100)
        }));
      
      return {
        university: 'Bangladesh Army International University of Science and Technology (BAIUST)',
        universityId: this.universityId,
        totalMembers: allContests.totalMembers,
        totalContests: allContests.totalContests,
        totalProblemsSolved: allContests.totalProblemsSolved,
        averageProblemsPerMember: allContests.averageProblemsPerMember,
        lastUpdated: new Date().toISOString(),
        contests: popularContests,
        statistics: {
          mostPopularContest: popularContests[0] || null,
          averageParticipationPerContest: Math.round(allContests.totalParticipations / allContests.totalContests),
          highParticipationContests: popularContests.filter(c => c.participationRate >= 20).length,
          mediumParticipationContests: popularContests.filter(c => c.participationRate >= 10 && c.participationRate < 20).length,
          lowParticipationContests: popularContests.filter(c => c.participationRate < 10).length
        },
        problemSolvingStats: allContests.problemSolvingStats
      };
    } catch (error) {
      console.error('Error getting popular contests:', error.message);
      throw error;
    }
  }

  // Get contest participation timeline for a specific year
  async getContestTimeline(year = new Date().getFullYear()) {
    try {
      const allContests = await this.getUniversityContests();
      
      // Filter contests by year
      const yearContests = allContests.contests.filter(contest => {
        const contestYear = new Date(contest.lastParticipation).getFullYear();
        return contestYear === year;
      });
      
      // Group by month
      const monthlyData = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Initialize all months
      months.forEach((month, index) => {
        monthlyData[month] = {
          month: month,
          monthNumber: index + 1,
          contests: 0,
          totalParticipations: 0,
          averageParticipants: 0,
          contestsList: []
        };
      });
      
      // Process contests
      yearContests.forEach(contest => {
        const contestDate = new Date(contest.lastParticipation);
        const monthIndex = contestDate.getMonth();
        const monthName = months[monthIndex];
        
        monthlyData[monthName].contests++;
        monthlyData[monthName].totalParticipations += contest.totalParticipants;
        monthlyData[monthName].contestsList.push({
          contestId: contest.contestId,
          contestName: contest.contestName,
          participants: contest.totalParticipants,
          date: contest.lastParticipation
        });
      });
      
      // Calculate averages
      Object.values(monthlyData).forEach(month => {
        month.averageParticipants = month.contests > 0 ? 
          Math.round(month.totalParticipations / month.contests) : 0;
      });
      
      const timeline = Object.values(monthlyData);
      
      return {
        university: 'Bangladesh Army International University of Science and Technology (BAIUST)',
        universityId: this.universityId,
        year: year,
        totalContests: yearContests.length,
        totalParticipations: yearContests.reduce((sum, c) => sum + c.totalParticipants, 0),
        totalProblemsSolved: allContests.totalProblemsSolved,
        averageProblemsPerMember: allContests.averageProblemsPerMember,
        lastUpdated: new Date().toISOString(),
        monthlyTimeline: timeline,
        summary: {
          mostActiveMonth: timeline.reduce((max, month) => 
            month.contests > max.contests ? month : max, timeline[0]),
          averageContestsPerMonth: Math.round(yearContests.length / 12),
          averageParticipationsPerMonth: Math.round(
            yearContests.reduce((sum, c) => sum + c.totalParticipants, 0) / 12
          ),
          peakParticipationMonth: timeline.reduce((max, month) => 
            month.totalParticipations > max.totalParticipations ? month : max, timeline[0])
        },
        problemSolvingStats: allContests.problemSolvingStats
      };
    } catch (error) {
      console.error('Error getting contest timeline:', error.message);
      throw error;
    }
  }

  // Get university ranking
  async getUniversityRanking() {
    try {
      console.log('Fetching university ranking...');
      
      // Get all university members
      const members = await this.getUniversityMembers();
      
      if (members.length === 0) {
        throw new Error('No university members found');
      }
      
      console.log(`Processing ${members.length} members...`);
      
      // Get stats for all members with smart batching
      const rankings = [];
      const batchSize = 5; // Process 5 users at a time
      
      console.log(`Processing ${members.length} members in batches of ${batchSize}...`);
      
      for (let i = 0; i < members.length; i += batchSize) {
        const batch = members.slice(i, i + batchSize);
        
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(members.length / batchSize)} (users ${i + 1}-${Math.min(i + batchSize, members.length)})`);
        
        // Process batch in parallel but with some delay between batches
        const batchPromises = batch.map(async (member, index) => {
          try {
            // Small staggered delay within batch to avoid hitting rate limits
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, index * 100));
            }
            return await this.getUserStats(member.handle);
          } catch (error) {
            console.error(`Error processing user ${member.handle}:`, error.message);
            return {
              handle: member.handle,
              displayName: member.displayName || member.handle,
              rating: 0,
              maxRating: 0,
              contestsParticipated: 0,
              problemsSolved: 0,
              totalPoints: 0,
              error: error.message
            };
          }
        });
        
        try {
          const batchResults = await Promise.all(batchPromises);
          rankings.push(...batchResults.filter(result => !result.error)); // Only add successful results
          
          // Short delay between batches (not between individual users)
          if (i + batchSize < members.length) {
            await new Promise(resolve => setTimeout(resolve, 800)); // 800ms between batches
          }
        } catch (error) {
          console.error(`Error processing batch:`, error.message);
        }
      }
      
      // Sort by rating (highest first)
      rankings.sort((a, b) => b.rating - a.rating);
      
      // Add rank positions
      rankings.forEach((user, index) => {
        user.universityRank = index + 1;
      });
      
      console.log(`Successfully processed ${rankings.length} members`);
      
      return {
        university: 'Bangladesh Army International University of Science and Technology (BAIUST)',
        universityId: this.universityId,
        totalMembers: rankings.length,
        lastUpdated: new Date().toISOString(),
        rankings: rankings
      };
    } catch (error) {
      console.error('Error getting university ranking:', error.message);
      throw error;
    }
  }
}

module.exports = new CodeforcesService();
