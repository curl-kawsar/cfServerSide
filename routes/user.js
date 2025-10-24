const express = require('express');
const router = express.Router();
const codeforcesService = require('../services/codeforcesService');

// Get specific user statistics
router.get('/:handle', async (req, res) => {
  const handle = req.params.handle;
  const cacheKey = `user_stats_${handle}`;
  
  if (!handle || handle.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Invalid handle parameter',
      message: 'Handle cannot be empty'
    });
  }

  try {
    // Check cache first
    const cachedResult = req.cache.get(cacheKey);
    if (cachedResult) {
      console.log(`Returning cached stats for user: ${handle}`);
      return res.json({
        success: true,
        data: cachedResult,
        cached: true,
        message: `Stats for user ${handle} retrieved from cache`
      });
    }

    console.log(`Fetching fresh stats for user: ${handle}`);
    const userStats = await codeforcesService.getUserStats(handle);
    
    if (userStats.error) {
      return res.status(404).json({
        success: false,
        error: 'User not found or data unavailable',
        message: userStats.error
      });
    }
    
    // Cache the result for 5 minutes
    req.cache.set(cacheKey, userStats, 300);
    
    res.json({
      success: true,
      data: userStats,
      cached: false,
      message: `Stats for user ${handle} retrieved successfully`
    });
  } catch (error) {
    console.error(`Error fetching user stats for ${handle}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics',
      message: error.message
    });
  }
});

// Get user contest participation history
router.get('/:handle/contests', async (req, res) => {
  const handle = req.params.handle;
  const cacheKey = `user_contests_${handle}`;
  
  if (!handle || handle.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Invalid handle parameter',
      message: 'Handle cannot be empty'
    });
  }

  try {
    // Check cache first
    const cachedResult = req.cache.get(cacheKey);
    if (cachedResult) {
      console.log(`Returning cached contest history for user: ${handle}`);
      return res.json({
        success: true,
        data: cachedResult,
        cached: true,
        message: `Contest history for user ${handle} retrieved from cache`
      });
    }

    console.log(`Fetching contest history for user: ${handle}`);
    const ratingHistory = await codeforcesService.getUserRating(handle);
    
    // Process rating history to get contest details
    const contests = ratingHistory.map((entry, index) => ({
      contestId: entry.contestId,
      contestName: entry.contestName,
      rank: entry.rank,
      oldRating: entry.oldRating,
      newRating: entry.newRating,
      ratingChange: entry.newRating - entry.oldRating,
      date: new Date(entry.ratingUpdateTimeSeconds * 1000).toISOString(),
      performanceIndex: index + 1
    }));

    const contestStats = {
      handle: handle,
      totalContests: contests.length,
      contests: contests,
      ratingProgress: {
        startRating: contests.length > 0 ? contests[contests.length - 1].oldRating : 0,
        currentRating: contests.length > 0 ? contests[0].newRating : 0,
        maxRating: Math.max(...contests.map(c => c.newRating), 0),
        bestRank: Math.min(...contests.map(c => c.rank), Infinity) === Infinity ? null : Math.min(...contests.map(c => c.rank)),
        totalRatingGain: contests.length > 0 ? contests[0].newRating - contests[contests.length - 1].oldRating : 0
      }
    };
    
    // Cache for 5 minutes
    req.cache.set(cacheKey, contestStats, 300);
    
    res.json({
      success: true,
      data: contestStats,
      cached: false,
      message: `Contest history for user ${handle} retrieved successfully`
    });
  } catch (error) {
    console.error(`Error fetching contest history for ${handle}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contest history',
      message: error.message
    });
  }
});

// Get user problem solving statistics
router.get('/:handle/problems', async (req, res) => {
  const handle = req.params.handle;
  const cacheKey = `user_problems_${handle}`;
  
  if (!handle || handle.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Invalid handle parameter',
      message: 'Handle cannot be empty'
    });
  }

  try {
    // Check cache first
    const cachedResult = req.cache.get(cacheKey);
    if (cachedResult) {
      console.log(`Returning cached problem stats for user: ${handle}`);
      return res.json({
        success: true,
        data: cachedResult,
        cached: true,
        message: `Problem statistics for user ${handle} retrieved from cache`
      });
    }

    console.log(`Fetching problem statistics for user: ${handle}`);
    const submissions = await codeforcesService.getUserSubmissions(handle);
    
    // Analyze submissions
    const solvedProblems = new Map();
    const verdictCounts = {};
    const languageCounts = {};
    const tagCounts = {};
    const ratingCounts = {};
    
    submissions.forEach(submission => {
      // Count verdicts
      const verdict = submission.verdict || 'UNKNOWN';
      verdictCounts[verdict] = (verdictCounts[verdict] || 0) + 1;
      
      // Count languages
      const language = submission.programmingLanguage || 'Unknown';
      languageCounts[language] = (languageCounts[language] || 0) + 1;
      
      // Track solved problems
      if (verdict === 'OK') {
        const problemKey = `${submission.problem.contestId}-${submission.problem.index}`;
        if (!solvedProblems.has(problemKey)) {
          solvedProblems.set(problemKey, {
            contestId: submission.problem.contestId,
            index: submission.problem.index,
            name: submission.problem.name,
            rating: submission.problem.rating,
            tags: submission.problem.tags || [],
            points: submission.problem.points || 0,
            solvedAt: new Date(submission.creationTimeSeconds * 1000).toISOString()
          });
          
          // Count problem tags
          if (submission.problem.tags) {
            submission.problem.tags.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          }
          
          // Count problem ratings
          if (submission.problem.rating) {
            const ratingRange = Math.floor(submission.problem.rating / 100) * 100;
            const rangeKey = `${ratingRange}-${ratingRange + 99}`;
            ratingCounts[rangeKey] = (ratingCounts[rangeKey] || 0) + 1;
          }
        }
      }
    });

    const problemStats = {
      handle: handle,
      totalSubmissions: submissions.length,
      solvedCount: solvedProblems.size,
      successRate: submissions.length > 0 ? 
        Math.round((verdictCounts['OK'] || 0) / submissions.length * 100) : 0,
      verdictDistribution: verdictCounts,
      languageDistribution: languageCounts,
      tagDistribution: Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20) // Top 20 tags
        .reduce((obj, [key, val]) => {
          obj[key] = val;
          return obj;
        }, {}),
      ratingDistribution: Object.entries(ratingCounts)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .reduce((obj, [key, val]) => {
          obj[key] = val;
          return obj;
        }, {}),
      solvedProblems: Array.from(solvedProblems.values())
        .sort((a, b) => new Date(b.solvedAt) - new Date(a.solvedAt))
        .slice(0, 100), // Latest 100 solved problems
      statistics: {
        averageProblemRating: solvedProblems.size > 0 ? 
          Math.round(Array.from(solvedProblems.values())
            .filter(p => p.rating)
            .reduce((sum, p) => sum + p.rating, 0) / 
            Array.from(solvedProblems.values()).filter(p => p.rating).length) || 0 : 0,
        totalPoints: Array.from(solvedProblems.values())
          .reduce((sum, p) => sum + (p.points || 0), 0),
        firstSubmission: submissions.length > 0 ? 
          new Date(Math.min(...submissions.map(s => s.creationTimeSeconds)) * 1000).toISOString() : null,
        lastSubmission: submissions.length > 0 ? 
          new Date(Math.max(...submissions.map(s => s.creationTimeSeconds)) * 1000).toISOString() : null
      }
    };
    
    // Cache for 5 minutes
    req.cache.set(cacheKey, problemStats, 300);
    
    res.json({
      success: true,
      data: problemStats,
      cached: false,
      message: `Problem statistics for user ${handle} retrieved successfully`
    });
  } catch (error) {
    console.error(`Error fetching problem stats for ${handle}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch problem statistics',
      message: error.message
    });
  }
});

// Compare two users
router.get('/compare/:handle1/:handle2', async (req, res) => {
  const handle1 = req.params.handle1;
  const handle2 = req.params.handle2;
  
  if (!handle1 || !handle2 || handle1.trim() === '' || handle2.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Invalid handle parameters',
      message: 'Both handles must be provided and cannot be empty'
    });
  }

  try {
    console.log(`Comparing users: ${handle1} vs ${handle2}`);
    
    // Get stats for both users
    const [stats1, stats2] = await Promise.all([
      codeforcesService.getUserStats(handle1),
      codeforcesService.getUserStats(handle2)
    ]);
    
    if (stats1.error || stats2.error) {
      return res.status(404).json({
        success: false,
        error: 'One or both users not found',
        message: `Errors: ${stats1.error || 'None'}, ${stats2.error || 'None'}`
      });
    }

    const comparison = {
      users: {
        user1: stats1,
        user2: stats2
      },
      comparison: {
        ratingDifference: stats1.rating - stats2.rating,
        contestDifference: stats1.contestsParticipated - stats2.contestsParticipated,
        problemsDifference: stats1.problemsSolved - stats2.problemsSolved,
        pointsDifference: stats1.totalPoints - stats2.totalPoints,
        winner: {
          byRating: stats1.rating > stats2.rating ? handle1 : stats2.rating > stats1.rating ? handle2 : 'tie',
          byContests: stats1.contestsParticipated > stats2.contestsParticipated ? handle1 : 
                     stats2.contestsParticipated > stats1.contestsParticipated ? handle2 : 'tie',
          byProblems: stats1.problemsSolved > stats2.problemsSolved ? handle1 : 
                     stats2.problemsSolved > stats1.problemsSolved ? handle2 : 'tie',
          byPoints: stats1.totalPoints > stats2.totalPoints ? handle1 : 
                   stats2.totalPoints > stats1.totalPoints ? handle2 : 'tie'
        }
      }
    };
    
    res.json({
      success: true,
      data: comparison,
      message: `Comparison between ${handle1} and ${handle2} completed successfully`
    });
  } catch (error) {
    console.error(`Error comparing users ${handle1} and ${handle2}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to compare users',
      message: error.message
    });
  }
});

module.exports = router;
