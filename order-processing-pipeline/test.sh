#!/bin/bash

# Order Processing Pipeline Test Script
# Tests the complete pipeline end-to-end

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
check_env() {
    if [[ -z "$FLAMEFLARE_URL" ]]; then
        echo_error "FLAMEFLARE_URL environment variable is required"
        exit 1
    fi

    if [[ -z "$FLAMEFLARE_API_KEY" ]]; then
        echo_error "FLAMEFLARE_API_KEY environment variable is required"
        exit 1
    fi

    if [[ -z "$FLAMEFLARE_ACCOUNT_ID" ]]; then
        echo_error "FLAMEFLARE_ACCOUNT_ID environment variable is required"
        exit 1
    fi

    echo_info "Testing with:"
    echo "  FLAMEFLARE_URL: $FLAMEFLARE_URL"
    echo "  FLAMEFLARE_ACCOUNT_ID: $FLAMEFLARE_ACCOUNT_ID"
    echo
}

# API helper function
api_call() {
    local method=$1
    local endpoint=$2
    local data=${3:-""}
    
    if [[ -n "$data" ]]; then
        curl -s -X "$method" \
            "$FLAMEFLARE_URL$endpoint" \
            -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" \
            "$FLAMEFLARE_URL$endpoint" \
            -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
    fi
}

# Worker dispatch helper
worker_dispatch() {
    local worker_name=$1
    local path=${2:-"/"}
    local method=${3:-"GET"}
    local data=${4:-""}
    
    local url="$FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/$worker_name/dispatch"
    
    if [[ "$path" != "/" ]]; then
        url="${url}?path=${path}"
    fi
    
    if [[ -n "$data" ]]; then
        curl -s -X "$method" \
            "$url" \
            -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" \
            "$url" \
            -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
    fi
}

# Create a test order
create_test_order() {
    local order_id="test_order_$(date +%s)"
    
    echo_info "Creating test order: $order_id"
    
    local order_data="{
        \"orderId\": \"$order_id\",
        \"items\": [
            {\"name\": \"Premium Widget\", \"price\": 49.99, \"quantity\": 2},
            {\"name\": \"Super Gadget\", \"price\": 25.99, \"quantity\": 1},
            {\"name\": \"Mini Tool\", \"price\": 12.50, \"quantity\": 3}
        ],
        \"customer\": {
            \"name\": \"Alice Johnson\",
            \"email\": \"alice.johnson@example.com\",
            \"phone\": \"+1-555-0199\",
            \"address\": \"123 Test Street, Demo City, DC 12345\"
        }
    }"
    
    local response=$(worker_dispatch "order-api" "/order" "POST" "$order_data")
    
    echo "Response:"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    echo
    
    # Extract instanceId for status tracking
    local instance_id=$(echo "$response" | jq -r '.instanceId // empty' 2>/dev/null || echo "")
    
    if [[ -n "$instance_id" ]]; then
        echo_success "Order created successfully"
        echo "  Order ID: $order_id"
        echo "  Instance ID: $instance_id"
        echo "$order_id,$instance_id"
    else
        echo_error "Failed to create order or extract instance ID"
        return 1
    fi
}

# Check order status
check_order_status() {
    local order_id=$1
    local instance_id=$2
    
    echo_info "Checking order status: $order_id"
    
    local response=$(worker_dispatch "order-api" "/status?instanceId=$instance_id" "GET")
    
    echo "Order Status Response:"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    echo
}

# Check queue stats
check_queue_stats() {
    local queue_name=$1
    
    echo_info "Checking queue stats: $queue_name"
    
    local response=$(api_call GET "/accounts/$FLAMEFLARE_ACCOUNT_ID/queues/$queue_name")
    
    echo "Queue Stats:"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    echo
}

# Check workflow instances
check_workflow_instances() {
    echo_info "Checking workflow instances"
    
    local response=$(api_call GET "/accounts/$FLAMEFLARE_ACCOUNT_ID/workflows/order-fulfillment/instances")
    
    echo "Workflow Instances:"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    echo
}

# Test cleanup service
test_cleanup_service() {
    echo_info "Testing cleanup service via service binding"
    
    local response=$(worker_dispatch "order-api" "/cleanup" "POST" "{}")
    
    echo "Cleanup Response:"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    echo
}

# Test individual workers
test_worker_info() {
    local worker_name=$1
    
    echo_info "Testing worker info: $worker_name"
    
    local response=$(worker_dispatch "$worker_name" "/" "GET")
    
    echo "$worker_name Info:"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    echo
}

# Main test sequence
main() {
    echo_info "Starting Order Processing Pipeline Tests"
    echo
    
    # Check environment
    check_env
    
    # Test 1: Check all workers are responding
    echo_info "=== Test 1: Worker Health Check ==="
    test_worker_info "order-api"
    test_worker_info "payment-processor"
    test_worker_info "notification-sender"
    test_worker_info "cleanup-worker"
    
    # Test 2: Check initial queue states
    echo_info "=== Test 2: Initial Queue States ==="
    check_queue_stats "payment-queue"
    check_queue_stats "notification-queue"
    
    # Test 3: Create and process an order
    echo_info "=== Test 3: Create Test Order ==="
    local order_result=$(create_test_order)
    
    if [[ $? -ne 0 ]]; then
        echo_error "Order creation failed, aborting tests"
        exit 1
    fi
    
    local order_id=$(echo "$order_result" | cut -d',' -f1)
    local instance_id=$(echo "$order_result" | cut -d',' -f2)
    
    # Test 4: Check immediate order status
    echo_info "=== Test 4: Immediate Order Status ==="
    check_order_status "$order_id" "$instance_id"
    
    # Test 5: Check queues after order creation
    echo_info "=== Test 5: Queue States After Order Creation ==="
    check_queue_stats "payment-queue"
    check_queue_stats "notification-queue"
    
    # Test 6: Wait and check processing
    echo_info "=== Test 6: Wait for Processing (10 seconds) ==="
    echo_info "Waiting 10 seconds for queue processing..."
    sleep 10
    
    check_order_status "$order_id" "$instance_id"
    check_queue_stats "payment-queue"
    check_queue_stats "notification-queue"
    
    # Test 7: Check workflow instances
    echo_info "=== Test 7: Workflow Instances ==="
    check_workflow_instances
    
    # Test 8: Test cleanup service
    echo_info "=== Test 8: Cleanup Service Test ==="
    test_cleanup_service
    
    # Test 9: Wait longer and final check
    echo_info "=== Test 9: Extended Wait and Final Check (15 seconds) ==="
    echo_info "Waiting 15 more seconds for complete processing..."
    sleep 15
    
    echo_info "Final Status Check:"
    check_order_status "$order_id" "$instance_id"
    
    echo_info "Final Queue States:"
    check_queue_stats "payment-queue"
    check_queue_stats "notification-queue"
    
    echo
    echo_success "=== Test Suite Complete ==="
    echo_info "Pipeline test completed successfully!"
    echo
    echo_info "To monitor ongoing activity:"
    echo "  Dashboard: ${FLAMEFLARE_URL%/client/v4}/dashboard"
    echo "  Order API: curl $FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/order-api/dispatch"
    echo
    echo_info "To create more test orders:"
    echo "  ./test.sh"
    echo "  Or use: curl -X POST $FLAMEFLARE_URL/accounts/$FLAMEFLARE_ACCOUNT_ID/workers/order-api/dispatch \\"
    echo "    -H 'Authorization: Bearer $FLAMEFLARE_API_KEY' \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"orderId\": \"custom_order_123\", \"items\": [...]}'"
}

# Run main function
main "$@"