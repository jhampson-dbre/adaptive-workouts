# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Nudge serves individual trainees who typically train alone and use the product on a phone. They may be beginners or advanced lifters, and their goals may include general fitness, maintaining or improving strength, hypertrophy, or other training outcomes.

Their schedules may be irregular because of parenting, shift work, or other commitments. They need training sessions to fit the time they have rather than organizing life around fixed workout splits or designated training days.

## Product Purpose

Nudge makes training fit real life. Whenever a user has time to train, it turns the available time into a focused, relevant workout by adapting to their training history. It carries the user through planning, performing, and reviewing the session.

Success means the user can make worthwhile training progress without needing a predictable schedule.

## Positioning

Nudge is an adaptive training partner that remembers what the user has done, decides what is worth doing next, and turns the time available into a focused workout.

Its core mechanism combines the user's available time, current recovery input, personal exercise catalog, and training history. It does not depend on a fixed weekly split or designated training days.

## Operating Context

- The user typically plans and performs a workout alone on a phone.
- The core path runs from Plan through the active workout, concurrent rest and transitions, Cooldown, and Review/completion.
- Users provide the time available and identify unrecovered muscle groups before generating a plan.
- Nudge persists the user's exercise catalog, settings, active workout, and workout history to support future sessions.
- The product is an installable web app backed by authenticated, user-owned cloud data.

## Capabilities and Constraints

- Generate a workout from the user's available time, recovery input, exercise catalog, settings, and training history.
- Support simple-completion, weighted-set, and bodyweight-repetition tracking.
- Track workout phases, set work, rest, transitions, completion, and workout history.
- Preserve user agency throughout planning, performance, recovery, and completion.
- Preserve the existing workout engine, stored data, authentication, recovery semantics, navigation model, timing, persistence, lazy loading, feedback, focus behavior, and session behavior unless a separately approved task changes them.
- Do not add unsupported intelligence claims, readiness claims, coaching logic, recommendations, gamification, routes, navigation, or stored state.
- Access is currently limited to authenticated, approved users, with each user's data isolated from other users.

## Brand Commitments

- The product name is **Nudge**, replacing **Adaptive Workouts**.
- The core value statement is **Training fits real life.**
- TREK-233 establishes Nudge's first coherent product identity and interface system without changing existing product behavior.

## Evidence on Hand

- The repository contains the working React application, its current product copy, behavioral tests, accessibility contracts, and Firebase security rules.
- The repository does not contain confirmed testimonials, customer logos, outcome studies, benchmarks, or other marketing proof; future work must not fabricate them.

## Product Principles

1. Training adapts to the user's life, not the reverse.
2. Make the time available useful without requiring a predictable schedule.
3. Use remembered training history and explicit user input while preserving user agency.
4. Support a focused session from planning through completion.
5. Do not imply intelligence, readiness, coaching, or outcomes the product cannot substantiate.

## Accessibility & Inclusion

Nudge must support phone use during an active workout and remain usable across beginner and advanced experience levels. Preserve keyboard focus, accessible feedback, readable timing and status information, touch-target behavior, and responsive operation across the complete Plan, Perform, and Review path.
