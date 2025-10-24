# BAIUST OJ Ranking API

A Node.js Express API to fetch and display competitive programming rankings for Bangladesh Army International University of Science and Technology (BAIUST) from Codeforces.

## Features

- **University Ranking**: Get complete ranking of all BAIUST members on Codeforces
- **Individual User Stats**: Detailed statistics for any Codeforces user
- **Contest History**: User's contest participation and rating changes
- **Problem Statistics**: Comprehensive problem-solving analytics
- **Caching**: Intelligent caching to reduce API calls and improve performance
- **Rate Limiting**: Built-in rate limiting to respect Codeforces API limits

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd baiust-oj-ranking-api
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### University Ranking

#### `GET /api/ranking/university`
Get complete university ranking with all members' statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "university": "Bangladesh Army International University of Science and Technology (BAIUST)",
    "universityId": "13125",
    "totalMembers": 45,
    "lastUpdated": "2024-10-23T10:30:00.000Z",
    "rankings": [
      {
        "handle": "user1",
        "displayName": "John Doe",
        "universityRank": 1,
        "rating": 1850,
        "maxRating": 1920,
        "contestsParticipated": 25,
        "problemsSolved": 150,
        "totalPoints": 2500,
        "rank": "expert",
        "maxRank": "expert"
      }
    ]
  }
}
```

#### `GET /api/ranking/university/top/{count}`
Get top N users from the university ranking.

**Parameters:**
- `count`: Number of top users to retrieve (1-100)

#### `GET /api/ranking/university/summary`
Get university statistics summary including rating distribution and averages.

#### `GET /api/ranking/university/contests`
Get all contests participated by university members with detailed participation data.

**Response includes:**
- All contests with university participation
- Participant details for each contest (including problems solved by each member)
- Contest statistics (average rank, rating changes)
- Individual member participation history
- Total problems solved across all members
- Problem-solving distribution and statistics

#### `GET /api/ranking/university/contests/popular?limit=20`
Get most popular contests among university members.

**Parameters:**
- `limit`: Number of popular contests to retrieve (default: 20)

**Response includes:**
- Top contests by participation count
- Participation rates and statistics
- Average performance in each contest
- Total problems solved by all members
- Problem-solving statistics and distribution

#### `GET /api/ranking/university/contests/timeline?year=2024`
Get contest participation timeline for a specific year.

**Parameters:**
- `year`: Year to analyze (default: current year)

**Response includes:**
- Monthly contest participation breakdown
- Contest activity trends
- Peak participation periods
- Total problems solved statistics
- Problem-solving performance analysis

#### `POST /api/ranking/university/refresh`
Force refresh the university ranking data (clears cache).

### User Statistics

#### `GET /api/user/{handle}`
Get comprehensive statistics for a specific user.

**Parameters:**
- `handle`: Codeforces user handle

**Response:**
```json
{
  "success": true,
  "data": {
    "handle": "tourist",
    "displayName": "Gennady Korotkevich",
    "rating": 3900,
    "maxRating": 3900,
    "contestsParticipated": 100,
    "problemsSolved": 2500,
    "totalPoints": 15000,
    "totalSubmissions": 5000,
    "successfulSubmissions": 3200,
    "successRate": 64,
    "rank": "legendary grandmaster",
    "maxRank": "legendary grandmaster"
  }
}
```

#### `GET /api/user/{handle}/contests`
Get user's contest participation history and rating changes.

#### `GET /api/user/{handle}/problems`
Get detailed problem-solving statistics including:
- Solved problems list
- Verdict distribution
- Programming language usage
- Problem tag analysis
- Rating distribution of solved problems

#### `GET /api/user/compare/{handle1}/{handle2}`
Compare statistics between two users.

### Health Check

#### `GET /health`
Check if the API is running properly.

#### `GET /`
Get API information and available endpoints.

## Data Provided

For each user, the API provides:

1. **Contest Participation**: Number of rated contests participated
2. **Problems Solved**: Unique problems solved successfully
3. **Rating Information**: Current rating, maximum rating achieved
4. **Total Points**: Sum of all points earned from problems
5. **Additional Metrics**:
   - Success rate (percentage of successful submissions)
   - Total submissions
   - Rank information
   - Registration and last online time
   - Country, city, and organization information

## Caching Strategy

- **University Ranking**: Cached for 10 minutes
- **User Statistics**: Cached for 5 minutes
- **Individual Endpoints**: Cached for 5 minutes

Cache is automatically managed and can be force-refreshed using the refresh endpoints.

## Rate Limiting

The API implements intelligent rate limiting to respect Codeforces API limits:
- Maximum 5 requests per second to Codeforces API
- 200ms delay between consecutive requests
- Batch processing for multiple users with controlled concurrency

## Error Handling

The API includes comprehensive error handling for:
- Invalid user handles
- Network connectivity issues
- Codeforces API errors
- Rate limit exceeded scenarios
- Data processing errors

All errors return structured JSON responses with appropriate HTTP status codes.

## Configuration

The server can be configured using environment variables:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## University Information

- **Organization ID**: 13125
- **University**: Bangladesh Army International University of Science and Technology (BAIUST)
- **Codeforces URL**: https://codeforces.com/ratings/organization/13125

## Technical Details

### Dependencies

- **express**: Web framework
- **axios**: HTTP client for API calls
- **cheerio**: HTML parsing for web scraping
- **node-cache**: In-memory caching
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment configuration

### Architecture

```
├── server.js           # Main server file
├── routes/
│   ├── ranking.js      # University ranking endpoints
│   └── user.js         # User statistics endpoints
├── services/
│   └── codeforcesService.js  # Codeforces API integration
└── package.json        # Dependencies and scripts
```

## Usage Examples

### Get University Ranking
```bash
curl http://localhost:3000/api/ranking/university
```

### Get Top 10 Users
```bash
curl http://localhost:3000/api/ranking/university/top/10
```

### Get User Statistics
```bash
curl http://localhost:3000/api/user/tourist
```

### Get University Summary
```bash
curl http://localhost:3000/api/ranking/university/summary
```

### Compare Two Users
```bash
curl http://localhost:3000/api/user/compare/tourist/Petr
```

### Get All University Contest Participation
```bash
curl http://localhost:3000/api/ranking/university/contests
```

### Get Popular Contests (Top 10)
```bash
curl "http://localhost:3000/api/ranking/university/contests/popular?limit=10"
```

### Get Contest Timeline for 2024
```bash
curl "http://localhost:3000/api/ranking/university/contests/timeline?year=2024"
```

### Get University Members List (with Individual Problem Counts)
```bash
curl http://localhost:3000/api/ranking/university/members
```
**Returns:** Complete member list with individual problems solved, submission counts, and success rates

**Example Response:**
```json
{
  "success": true,
  "data": {
    "university": "BAIUST",
    "totalMembers": 72,
    "totalProblemsAcrossAllMembers": 8547,
    "averageProblemsPerMember": 119,
    "members": [
      {
        "handle": "mdeasintuha",
        "displayName": "Md. EASIN",
        "rating": 1191,
        "maxRating": 1323,
        "organization": "BAIUST",
        "problemsSolved": 256,
        "totalSubmissions": 892,
        "successRate": 29
      }
    ],
    "statistics": {
      "topProblemSolver": {
        "handle": "mdeasintuha",
        "problemsSolved": 456
      },
      "problemSolvingDistribution": {
        "beginner": 15,
        "intermediate": 35,
        "advanced": 18,
        "expert": 4
      }
    }
  }
}
```

## Performance Considerations

- Data is cached to minimize API calls to Codeforces
- Batch processing with controlled concurrency for large datasets
- Rate limiting prevents API abuse
- Efficient data processing and aggregation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the repository
- Check the API documentation above
- Ensure proper rate limiting when making requests
