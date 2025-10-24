const express = require('express');
const router = express.Router();
const codeforcesService = require('../services/codeforcesService');

// Get university ranking (with caching for better performance)
router.get('/university', async (req, res) => {
  const cacheKey = 'university_ranking';
  const limit = parseInt(req.query.limit) || 0; // 0 means all users
  
  try {
    // Check cache first
    const cachedResult = req.cache.get(cacheKey);
    if (cachedResult) {
      console.log('Returning cached university ranking');
      let rankings = cachedResult.rankings;
      
      // Apply limit if specified
      if (limit > 0) {
        rankings = rankings.slice(0, limit);
      }
      
      return res.json({
        success: true,
        data: {
          ...cachedResult,
          rankings: rankings,
          requestedLimit: limit || 'all',
          actualCount: rankings.length
        },
        cached: true,
        message: 'University ranking data retrieved from cache'
      });
    }

    console.log('Fetching fresh university ranking data...');
    
    // For better UX, send immediate response if this is taking too long
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.json({
          success: false,
          error: 'Request timeout',
          message: 'Data is being processed. Please try again in a few moments.',
          processing: true
        });
      }
    }, 30000); // 30 second timeout
    
    const ranking = await codeforcesService.getUniversityRanking();
    clearTimeout(timeout);
    
    if (res.headersSent) {
      return; // Response already sent due to timeout
    }
    
    // Cache the result for 15 minutes
    req.cache.set(cacheKey, ranking, 900);
    
    let rankings = ranking.rankings;
    
    // Apply limit if specified
    if (limit > 0) {
      rankings = rankings.slice(0, limit);
    }
    
    res.json({
      success: true,
      data: {
        ...ranking,
        rankings: rankings,
        requestedLimit: limit || 'all',
        actualCount: rankings.length
      },
      cached: false,
      message: 'University ranking data retrieved successfully'
    });
  } catch (error) {
    console.error('Error in university ranking endpoint:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch university ranking',
        message: error.message
      });
    }
  }
});

// Get top N users from university
router.get('/university/top/:count', async (req, res) => {
  const count = parseInt(req.params.count) || 10;
  const cacheKey = 'university_ranking';
  
  if (count < 1 || count > 100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid count parameter',
      message: 'Count must be between 1 and 100'
    });
  }

  try {
    // Check cache first
    let ranking = req.cache.get(cacheKey);
    
    if (!ranking) {
      console.log('Cache miss, fetching fresh data...');
      ranking = await codeforcesService.getUniversityRanking();
      req.cache.set(cacheKey, ranking, 600);
    }

    const topUsers = ranking.rankings.slice(0, count);

    res.json({
      success: true,
      data: {
        university: ranking.university,
        universityId: ranking.universityId,
        totalMembers: ranking.totalMembers,
        requestedCount: count,
        actualCount: topUsers.length,
        lastUpdated: ranking.lastUpdated,
        rankings: topUsers
      },
      message: `Top ${topUsers.length} users retrieved successfully`
    });
  } catch (error) {
    console.error('Error in top users endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top users',
      message: error.message
    });
  }
});

// Get university statistics summary
router.get('/university/summary', async (req, res) => {
  const cacheKey = 'university_ranking';
  
  try {
    // Check cache first
    let ranking = req.cache.get(cacheKey);
    
    if (!ranking) {
      console.log('Cache miss, fetching fresh data...');
      ranking = await codeforcesService.getUniversityRanking();
      req.cache.set(cacheKey, ranking, 600);
    }

    const rankings = ranking.rankings;
    
    // Calculate summary statistics
    const totalMembers = rankings.length;
    const activeMembers = rankings.filter(user => user.rating > 0).length;
    const totalContestsParticipated = rankings.reduce((sum, user) => sum + user.contestsParticipated, 0);
    const totalProblemsSolved = rankings.reduce((sum, user) => sum + user.problemsSolved, 0);
    const averageRating = activeMembers > 0 ? 
      Math.round(rankings.filter(user => user.rating > 0).reduce((sum, user) => sum + user.rating, 0) / activeMembers) : 0;
    
    // Rating distribution
    const ratingRanges = {
      'Newbie (0-1199)': rankings.filter(user => user.rating >= 0 && user.rating < 1200).length,
      'Pupil (1200-1399)': rankings.filter(user => user.rating >= 1200 && user.rating < 1400).length,
      'Specialist (1400-1599)': rankings.filter(user => user.rating >= 1400 && user.rating < 1600).length,
      'Expert (1600-1899)': rankings.filter(user => user.rating >= 1600 && user.rating < 1900).length,
      'Candidate Master (1900-2099)': rankings.filter(user => user.rating >= 1900 && user.rating < 2100).length,
      'Master (2100-2299)': rankings.filter(user => user.rating >= 2100 && user.rating < 2300).length,
      'International Master (2300-2399)': rankings.filter(user => user.rating >= 2300 && user.rating < 2400).length,
      'Grandmaster (2400+)': rankings.filter(user => user.rating >= 2400).length
    };

    const topPerformer = rankings.length > 0 ? rankings[0] : null;

    res.json({
      success: true,
      data: {
        university: ranking.university,
        universityId: ranking.universityId,
        lastUpdated: ranking.lastUpdated,
        summary: {
          totalMembers,
          activeMembers,
          unratedMembers: totalMembers - activeMembers,
          totalContestsParticipated,
          totalProblemsSolved,
          averageRating,
          averageContestsPerMember: totalMembers > 0 ? Math.round(totalContestsParticipated / totalMembers) : 0,
          averageProblemsPerMember: totalMembers > 0 ? Math.round(totalProblemsSolved / totalMembers) : 0
        },
        ratingDistribution: ratingRanges,
        topPerformer: topPerformer ? {
          handle: topPerformer.handle,
          displayName: topPerformer.displayName,
          rating: topPerformer.rating,
          maxRating: topPerformer.maxRating,
          contestsParticipated: topPerformer.contestsParticipated,
          problemsSolved: topPerformer.problemsSolved
        } : null
      },
      message: 'University summary retrieved successfully'
    });
  } catch (error) {
    console.error('Error in university summary endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch university summary',
      message: error.message
    });
  }
});

// Get university members list (fast - without detailed stats)
router.get('/university/members', async (req, res) => {
  const cacheKey = 'university_members';
  
  try {
    // Check cache first
    const cachedResult = req.cache.get(cacheKey);
    if (cachedResult) {
      console.log('Returning cached university members');
      return res.json({
        success: true,
        data: cachedResult,
        cached: true,
        message: 'University members retrieved from cache'
      });
    }

    console.log('Fetching university members...');
    const members = await codeforcesService.getUniversityMembers();
    
    // Calculate aggregate statistics
    const totalProblemsAcrossMembers = members.reduce((sum, member) => sum + (member.problemsSolved || 0), 0);
    const averageProblemsPerMember = Math.round(totalProblemsAcrossMembers / members.length);
    const topProblemSolver = members.reduce((top, member) => 
      (member.problemsSolved || 0) > (top.problemsSolved || 0) ? member : top, members[0]);
    
    const memberData = {
      university: 'Bangladesh Army International University of Science and Technology (BAIUST)',
      universityId: '13125',
      totalMembers: members.length,
      totalProblemsAcrossAllMembers: totalProblemsAcrossMembers,
      averageProblemsPerMember: averageProblemsPerMember,
      lastUpdated: new Date().toISOString(),
      members: members.map(member => ({
        handle: member.handle,
        displayName: member.displayName,
        rating: member.rating || 0,
        maxRating: member.maxRating || 0,
        organization: member.organization,
        problemsSolved: member.problemsSolved || 0,
        totalSubmissions: member.totalSubmissions || 0,
        successRate: member.totalSubmissions > 0 ? 
          Math.round(((member.problemsSolved || 0) * 100) / member.totalSubmissions) : 0
      })),
      statistics: {
        topProblemSolver: {
          handle: topProblemSolver.handle,
          displayName: topProblemSolver.displayName,
          problemsSolved: topProblemSolver.problemsSolved || 0
        },
        problemSolvingDistribution: {
          beginner: members.filter(m => (m.problemsSolved || 0) <= 50).length,
          intermediate: members.filter(m => (m.problemsSolved || 0) > 50 && (m.problemsSolved || 0) <= 200).length,
          advanced: members.filter(m => (m.problemsSolved || 0) > 200 && (m.problemsSolved || 0) <= 500).length,
          expert: members.filter(m => (m.problemsSolved || 0) > 500).length
        },
        averageSuccessRate: Math.round(
          members.reduce((sum, m) => sum + (m.totalSubmissions > 0 ? 
            ((m.problemsSolved || 0) * 100) / m.totalSubmissions : 0), 0) / members.length
        )
      }
    };
    
    // Cache for 30 minutes
    req.cache.set(cacheKey, memberData, 1800);
    
    res.json({
      success: true,
      data: memberData,
      cached: false,
      message: 'University members retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching university members:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch university members',
      message: error.message
    });
  }
});

// Get all contests participated by university members
router.get('/university/contests', async (req, res) => {
  const cacheKey = 'university_contests';
  
  try {
    // Check cache first
    const cachedResult = req.cache.get(cacheKey);
    if (cachedResult) {
      console.log('Returning cached university contests');
      return res.json({
        success: true,
        data: cachedResult,
        cached: true,
        message: 'University contests data retrieved from cache'
      });
    }

    console.log('Fetching university contests data...');
    const contestData = await codeforcesService.getUniversityContests();
    
    // Cache for 1 hour
    req.cache.set(cacheKey, contestData, 3600);
    
    res.json({
      success: true,
      data: contestData,
      cached: false,
      message: 'University contests data retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching university contests:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch university contests',
      message: error.message
    });
  }
});

// Get popular contests among university members
router.get('/university/contests/popular', async (req, res) => {
  const cacheKey = 'university_contests_popular';
  const limit = parseInt(req.query.limit) || 20;
  
  try {
    // Check cache first
    const cachedResult = req.cache.get(cacheKey);
    if (cachedResult) {
      console.log('Returning cached popular contests');
      return res.json({
        success: true,
        data: {
          ...cachedResult,
          contests: cachedResult.contests.slice(0, limit)
        },
        cached: true,
        message: 'Popular contests data retrieved from cache'
      });
    }

    console.log('Fetching popular contests data...');
    const contestData = await codeforcesService.getPopularContests();
    
    // Cache for 2 hours
    req.cache.set(cacheKey, contestData, 7200);
    
    res.json({
      success: true,
      data: {
        ...contestData,
        contests: contestData.contests.slice(0, limit)
      },
      cached: false,
      message: 'Popular contests data retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching popular contests:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular contests',
      message: error.message
    });
  }
});

// Get contest participation timeline
router.get('/university/contests/timeline', async (req, res) => {
  const cacheKey = 'university_contests_timeline';
  const year = parseInt(req.query.year) || new Date().getFullYear();
  
  try {
    // Check cache first
    const cachedResult = req.cache.get(`${cacheKey}_${year}`);
    if (cachedResult) {
      console.log('Returning cached contest timeline');
      return res.json({
        success: true,
        data: cachedResult,
        cached: true,
        message: 'Contest timeline data retrieved from cache'
      });
    }

    console.log(`Fetching contest timeline for year ${year}...`);
    const timelineData = await codeforcesService.getContestTimeline(year);
    
    // Cache for 6 hours
    req.cache.set(`${cacheKey}_${year}`, timelineData, 21600);
    
    res.json({
      success: true,
      data: timelineData,
      cached: false,
      message: 'Contest timeline data retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching contest timeline:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contest timeline',
      message: error.message
    });
  }
});

// Refresh university ranking data
router.post('/university/refresh', async (req, res) => {
  const cacheKey = 'university_ranking';
  
  try {
    console.log('Force refreshing university ranking data...');
    
    // Clear cache
    req.cache.del(cacheKey);
    
    // Fetch fresh data
    const ranking = await codeforcesService.getUniversityRanking();
    
    // Cache the new result
    req.cache.set(cacheKey, ranking, 600);
    
    res.json({
      success: true,
      data: ranking,
      message: 'University ranking data refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing university ranking:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh university ranking',
      message: error.message
    });
  }
});

module.exports = router;
