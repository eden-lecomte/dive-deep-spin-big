# Feature List & Ideas

## 🎯 Priority Features

### 1. Voting Timer System
**Status:** 📝 Planned  
**Priority:** High

**Description:**
- Admin-triggered voting timer
- Default duration: 15 minutes (configurable)
- Timer displayed prominently during voting period
- When timer ends, automatically trigger wheel spin

**Details:**
- Timer countdown display (MM:SS format)
- Visual indicator (progress bar, pulsing, etc.)
- Sound bite when voting ends (e.g., "GET READY FOR THE NEXT BATTLE" from Tekken)
- Cool animations when voting period ends
- Admin can start/stop/reset timer
- Timer state synced across all clients via WebSocket

**Implementation Notes:**
- New WebSocket message: `voting_timer_start`, `voting_timer_stop`, `voting_timer_update`
- Timer state stored on server per room
- Client-side countdown with server sync for accuracy
- Audio file in `public/` directory
- Animation library consideration (Framer Motion or CSS animations)

---

### 2. Responsive UI Elements
**Status:** 📝 Planned  
**Priority:** High

**Description:**
- Make all interactive UI elements feel responsive and snazzy
- Smooth hover and click animations
- Visual feedback for all user interactions
- Balance between engaging and not annoying

**Details:**
- Button hover effects (scale, glow, color transitions)
- Click feedback (ripple, press animation)
- Smooth transitions for state changes
- Loading states with animations
- Micro-interactions for voting, spinning, etc.

**Implementation Notes:**
- Review current `globals.css` for animation styles
- Consider CSS transitions vs. animation library
- Test on various devices for performance
- Ensure animations don't interfere with functionality

---

### 3. Mobile-Friendly UI
**Status:** 📝 Planned  
**Priority:** High

**Description:**
- Optimize UI for mobile devices
- Responsive layout for all screen sizes
- Touch-friendly interactions
- Mobile-optimized wheel display

**Details:**
- Responsive sidebar panels (drawer/modal on mobile)
- Touch-optimized voting interface
- Mobile-friendly wheel sizing and interaction
- Optimized font sizes and spacing
- Swipe gestures where appropriate
- Viewport meta tags and responsive breakpoints

**Implementation Notes:**
- Test on actual mobile devices
- Consider mobile-first approach
- Review `app/components/panels/*` for mobile layouts
- WheelSection.tsx may need mobile-specific rendering

---

### 4. Refactored Voting System & Smart Algorithm
**Status:** 📝 Planned  
**Priority:** High

**Description:**
- Implement smart voting weight algorithm
- Base value system with tier multipliers
- Prevent extreme skewing while allowing votes to matter
- Optimized for ~10 people

**Current Proposal:**
- Base value per game: **1**
- Bronze vote: **+30%** (0.3)
- Silver vote: **+60%** (0.6)
- Gold vote: **+100%** (1.0)

**Example Calculation:**
- Game with 2 Gold, 1 Silver, 1 Bronze votes:
  - Base: 1.0
  - Gold: 2 × 1.0 = 2.0
  - Silver: 1 × 0.6 = 0.6
  - Bronze: 1 × 0.3 = 0.3
  - **Total weight: 3.9**

**Considerations:**
- Need to test with actual voting patterns
- May need to cap maximum weight to prevent single game dominance
- Consider normalization if needed
- Cumulative votes (can't vote same tier twice, but can vote different tiers)

**Implementation Notes:**
- Refactor voting calculation in `app/lib/utils.ts` or create new `votingAlgorithm.ts`
- Update `WheelSection.tsx` to use new weights
- Test with various vote distributions
- Consider admin override or manual weight adjustment

---

### 5. Basic Chat System
**Status:** 📝 Planned  
**Priority:** Medium

**Description:**
- Simple chat system for banter during voting/spinning
- Real-time message sync via WebSocket
- Room-based chat (messages per room)

**Details:**
- Chat panel/section in UI
- Real-time message delivery
- User identification (player name/color)
- Message history per room
- Optional: emoji support, message timestamps
- Optional: admin moderation (delete messages)

**Implementation Notes:**
- New WebSocket message: `chat_message`
- Chat state stored on server per room (with message history)
- New component: `ChatPanel.tsx` or integrate into existing panel
- Consider message limit per room (e.g., last 100 messages)
- UI: collapsible chat panel or dedicated section

---

## 📋 Additional Ideas & Considerations

### Future Enhancements
- [ ] Sound effects library (spin, vote, timer, etc.)
- [ ] Theme customization (colors, wheel styles)
- [ ] Voting statistics/history
- [ ] Export results (CSV, JSON)
- [ ] Persistent room history (save/load room states)
- [ ] Multiple wheel templates
- [ ] Admin dashboard with analytics
- [ ] User avatars/profile pictures
- [ ] Voting reminders/notifications
- [ ] Spectator mode (view-only, no voting)

### Technical Improvements
- [ ] Performance optimization for large item lists
- [ ] Better error handling and user feedback
- [ ] Connection status indicator
- [ ] Reconnection logic improvements
- [ ] Unit tests for voting algorithm
- [ ] E2E tests for critical flows

---

## 🎨 Design Considerations

### Animation Guidelines
- Keep animations under 300ms for interactions
- Use easing functions (ease-in-out, ease-out)
- Avoid animations that cause motion sickness
- Test with reduced motion preferences

### Mobile Guidelines
- Minimum touch target: 44×44px
- Adequate spacing between interactive elements
- Readable font sizes (minimum 16px)
- Consider landscape orientation

### Accessibility
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance
- Focus indicators

---

## 📝 Notes

- All features should maintain WebSocket sync across clients
- Admin controls should be clearly distinguished
- Consider backward compatibility when refactoring voting system
- Test features with actual user count (~10 people)
- Keep performance in mind, especially for mobile devices
